import "server-only";
import { inflateRawSync } from "node:zlib";

/*
 * Just enough of the zip format to read an uploaded file: the central
 * directory, stored and deflated entries. No zip64, no encryption. Every
 * entry is capped, so a small zip can't unpack into something huge.
 */

export class ZipError extends Error {}

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

export function isZip(bytes: Buffer) {
  return bytes.length >= 4 && bytes.readUInt32LE(0) === LOCAL;
}

/** The files in a zip, name → contents. Folders are left out; any entry over `maxBytes` fails the whole read. */
export function readZip(bytes: Buffer, maxBytes: number): Map<string, Buffer> {
  // The end-of-directory record sits in the last 22 bytes plus an optional comment (up to 64 KB).
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (bytes.readUInt32LE(i) === EOCD) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new ZipError("Not a zip file.");

  const count = bytes.readUInt16LE(end + 10);
  let at = bytes.readUInt32LE(end + 16);
  if (count > 2000) throw new ZipError("Too many files in the zip.");

  const files = new Map<string, Buffer>();
  for (let n = 0; n < count; n++) {
    if (at + 46 > bytes.length || bytes.readUInt32LE(at) !== CENTRAL) throw new ZipError("The zip is damaged.");
    const flags = bytes.readUInt16LE(at + 8);
    const method = bytes.readUInt16LE(at + 10);
    const packed = bytes.readUInt32LE(at + 20);
    const size = bytes.readUInt32LE(at + 24);
    const nameLength = bytes.readUInt16LE(at + 28);
    const extraLength = bytes.readUInt16LE(at + 30);
    const commentLength = bytes.readUInt16LE(at + 32);
    const local = bytes.readUInt32LE(at + 42);
    const name = bytes.subarray(at + 46, at + 46 + nameLength).toString("utf8");
    at += 46 + nameLength + extraLength + commentLength;

    if (name.endsWith("/")) continue;
    if (flags & 1) throw new ZipError("The zip is password-protected.");
    if (size > maxBytes) throw new ZipError(`${name} is too big.`);
    if (local + 30 > bytes.length || bytes.readUInt32LE(local) !== LOCAL) throw new ZipError("The zip is damaged.");
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    const data = bytes.subarray(start, start + packed);
    if (data.length !== packed) throw new ZipError("The zip is damaged.");

    if (method === 0) files.set(name, Buffer.from(data));
    else if (method === 8) {
      try {
        files.set(name, inflateRawSync(data, { maxOutputLength: maxBytes }));
      } catch {
        throw new ZipError(`${name} couldn't be unpacked.`);
      }
    } else throw new ZipError(`${name} uses a compression JodyOS can't read.`);
  }
  return files;
}
