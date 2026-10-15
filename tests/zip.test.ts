import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { ZipError, isZip, readZip } from "@/lib/zip";

/** A minimal zip writer for the tests: stored or deflated entries, no CRC (the reader doesn't check it). */
function makeZip(entries: { name: string; text: string; deflate?: boolean; encrypted?: boolean; method?: number }[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name);
    const raw = Buffer.from(e.text);
    const data = e.deflate ? deflateRawSync(raw) : raw;
    const method = e.method ?? (e.deflate ? 8 : 0);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(e.encrypted ? 1 : 0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(e.encrypted ? 1 : 0, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += 30 + name.length + data.length;
  }
  const dir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, end]);
}

describe("reading an uploaded zip", () => {
  it("reads stored and deflated files, skipping folders", () => {
    const zip = makeZip([
      { name: "folder/", text: "" },
      { name: "folder/agents.json", text: '{"a":1}', deflate: true },
      { name: "notes.txt", text: "hello" },
    ]);
    expect(isZip(zip)).toBe(true);
    const files = readZip(zip, 1000);
    expect([...files.keys()]).toEqual(["folder/agents.json", "notes.txt"]);
    expect(files.get("folder/agents.json")?.toString()).toBe('{"a":1}');
    expect(files.get("notes.txt")?.toString()).toBe("hello");
  });

  it("tells a zip from other files", () => {
    expect(isZip(Buffer.from('{"format":"jodyos-agents"}'))).toBe(false);
    expect(() => readZip(Buffer.from("not a zip at all, just text that is long enough"), 1000)).toThrow(ZipError);
  });

  it("refuses files that are too big, locked, damaged or packed in an unknown way", () => {
    const big = "x".repeat(5000);
    expect(() => readZip(makeZip([{ name: "big.json", text: big, deflate: true }]), 1000)).toThrow(/too big/);
    expect(() => readZip(makeZip([{ name: "a.json", text: "{}", encrypted: true }]), 1000)).toThrow(/password/);
    expect(() => readZip(makeZip([{ name: "a.json", text: "{}", method: 12 }]), 1000)).toThrow(/compression/);
    const cut = makeZip([{ name: "a.json", text: "{}" }]);
    cut.writeUInt32LE(0, 0); // break the local header
    expect(() => readZip(cut, 1000)).toThrow(/damaged/);
  });

  it("stops a deflated file from unpacking past the limit even if its header lies about the size", () => {
    const zip = makeZip([{ name: "bomb.json", text: "y".repeat(50_000), deflate: true }]);
    // Claim it unpacks to 10 bytes in both headers.
    const at = zip.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    zip.writeUInt32LE(10, at + 24);
    zip.writeUInt32LE(10, 22);
    expect(() => readZip(zip, 1000)).toThrow(/couldn't be unpacked/);
  });
});
