import "server-only";
import { connect } from "node:tls";
import { judge, readAnswer, type PageAnswer, type SiteHealth } from "@/lib/site-health";

/*
 * Checks a business's website the way a visitor would: loads the home page
 * over https and reads when its SSL certificate runs out. Nothing is stored;
 * the dashboard asks again each time it opens.
 */

const TIMEOUT_MS = 10_000;
const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; JodyOS site check)", Accept: "text/html,*/*;q=0.8" };

/** The start of the page is enough to read it; the rest isn't downloaded. */
async function readStart(res: Response, max = 65_536): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  while (text.length < max) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  await reader.cancel().catch(() => {});
  return text.slice(0, max);
}

async function load(url: string): Promise<PageAnswer & { ms: number }> {
  const started = Date.now();
  const res = await fetch(url, { redirect: "follow", cache: "no-store", headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const body = await readStart(res);
  return { status: res.status, headers: res.headers, body, ms: Date.now() - started };
}

/** When the site's certificate runs out, or null when it can't be read. Only the date is read; nothing is sent. */
function certificateEnd(host: string): Promise<Date | null> {
  return new Promise((resolve) => {
    // Not verifying here is deliberate: the page load above judges whether the certificate is valid.
    const socket = connect({ host, port: 443, servername: host, rejectUnauthorized: false, timeout: 8000 }, () => {
      const end = socket.getPeerCertificate()?.valid_to;
      socket.end();
      const date = end ? new Date(end) : null;
      resolve(date && !Number.isNaN(date.getTime()) ? date : null);
    });
    socket.on("error", () => resolve(null));
    socket.on("timeout", () => {
      socket.destroy();
      resolve(null);
    });
  });
}

/** The site's home page over https, whatever address was saved. Null when it isn't a web address. */
export function homeAddress(address: string): URL | null {
  try {
    const u = new URL(/^https?:\/\//i.test(address) ? address : `https://${address}`);
    return new URL(`https://${u.host}/`);
  } catch {
    return null;
  }
}

export async function checkSite(address: string, now: Date): Promise<SiteHealth> {
  const home = homeAddress(address);
  if (!home) return judge({ home: { error: new Error("bad address") }, sslEnd: null, now });
  const [page, sslEnd] = await Promise.all([load(home.href).catch((error: unknown) => ({ error })), certificateEnd(home.hostname)]);
  const robots =
    "status" in page && readAnswer(page).kind === "challenge"
      ? await load(new URL("/robots.txt", home).href).catch((error: unknown) => ({ error }))
      : null;
  return judge({ home: page, robots, sslEnd, now });
}
