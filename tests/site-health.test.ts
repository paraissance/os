import { describe, expect, it } from "vitest";
import { homeAddress } from "@/lib/site-check";
import { detectHost, judge, readAnswer, readFailure } from "@/lib/site-health";

const now = new Date("2026-10-15T12:00:00Z");
const inDays = (d: number) => new Date(now.getTime() + d * 86_400_000);
const answer = (status: number, headers: Record<string, string> = {}, body = "<html>Hello</html>") => ({ status, headers: new Headers(headers), body });
const failed = (code: string) => ({ error: Object.assign(new TypeError("fetch failed"), { cause: { code } }) });

describe("website live check", () => {
  it("is live when the home page loads, with how long it took and the SSL date", () => {
    const health = judge({ home: { ...answer(200, { "x-vercel-id": "abc" }), ms: 420 }, sslEnd: inDays(80), now });
    expect(health).toMatchObject({ live: true, problem: null, note: null, ms: 420, host: "Vercel", sslUntil: "2027-01-03" });
  });

  it("says plainly what's wrong when it isn't", () => {
    expect(judge({ home: { ...answer(503), ms: 90 }, sslEnd: null, now })).toMatchObject({ live: false, problem: "The site shows a server error (503)." });
    expect(judge({ home: { ...answer(404), ms: 90 }, sslEnd: null, now }).problem).toBe("The home page is missing (404).");
    expect(judge({ home: failed("ENOTFOUND"), sslEnd: null, now }).problem).toBe("The domain doesn't point to a server.");
    expect(judge({ home: failed("CERT_HAS_EXPIRED"), sslEnd: null, now }).problem).toBe("The SSL certificate has expired.");
    expect(readFailure(new DOMException("timed out", "TimeoutError"))).toBe("No answer within 10 seconds.");
    expect(readFailure(failed("ERR_TLS_CERT_ALTNAME_INVALID").error)).toBe("The SSL certificate isn't valid for this address.");
  });

  it("turns red a week before the SSL certificate runs out", () => {
    expect(judge({ home: { ...answer(200), ms: 1 }, sslEnd: inDays(3.5), now })).toMatchObject({ live: false, problem: "The SSL certificate runs out in 3 days." });
    expect(judge({ home: { ...answer(200), ms: 1 }, sslEnd: inDays(8), now }).live).toBe(true);
  });

  it("counts a host's bot check as up, without trying to get past it", () => {
    const humans = answer(409, { server: "nginx" }, '<script>document.cookie = "humans_21909=1"; document.location.reload(true)</script>');
    expect(readAnswer(humans)).toEqual({ kind: "guarded" });
    expect(judge({ home: { ...humans, ms: 300 }, sslEnd: null, now })).toMatchObject({ live: true, note: expect.stringContaining("bot check") });
  });

  it("looks at robots.txt when Cloudflare's check stands in front, and believes what it says", () => {
    const challenge = { ...answer(403, { "cf-mitigated": "challenge", server: "cloudflare" }, "<title>Just a moment...</title>"), ms: 200 };
    expect(readAnswer(challenge)).toEqual({ kind: "challenge" });
    expect(judge({ home: challenge, robots: answer(200, {}, "User-agent: *"), sslEnd: null, now })).toMatchObject({ live: true, note: expect.stringContaining("Cloudflare") });
    expect(judge({ home: challenge, robots: answer(502), sslEnd: null, now })).toMatchObject({ live: false, problem: "The site shows a server error (502)." });
  });

  it("tells the host from the answer when it shows", () => {
    expect(detectHost(new Headers({ server: "cloudflare" }), '<link href="https://kajabi-storefronts-production.kajabi-cdn.com/x.css">')).toBe("Kajabi");
    expect(detectHost(new Headers({ "x-powered-by": "WP Engine" }), "")).toBe("WP Engine");
    expect(detectHost(new Headers({ server: "nginx" }), "<html></html>")).toBeNull();
  });

  it("always checks the home page over https", () => {
    expect(homeAddress("http://allen.example.com/about")?.href).toBe("https://allen.example.com/");
    expect(homeAddress("leads.example.com")?.href).toBe("https://leads.example.com/");
    expect(homeAddress("not a url")).toBeNull();
  });
});
