import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import listFixture from "./fixtures/os-analytics-businesses.json";
import detailFixture from "./fixtures/os-analytics-business-example-leads.json";
import { parseEnv, EnvError } from "@/lib/env";

// The fixtures are the plugin's real output: tests/connector-test.php in the
// os-analytics-plugin repo runs the PHP connector and writes them here.

const BASE = "https://wp.example/wp-json/jdy/v1/os";
const KEY = "jdyos_0123456789abcdef0123456789abcdef0123456789abcdef";

let mod: typeof import("@/lib/os-analytics");

beforeAll(async () => {
  process.env.OS_ANALYTICS_URL = `${BASE}/`;
  process.env.OS_ANALYTICS_KEY = KEY;
  mod = await import("@/lib/os-analytics");
});

afterEach(() => vi.unstubAllGlobals());

function respond(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

describe("contract with the plugin", () => {
  it("parses the plugin's real list and detail responses", () => {
    expect(mod.businessListSchema.safeParse(listFixture).success).toBe(true);
    expect(mod.businessDetailSchema.safeParse(detailFixture).success).toBe(true);
  });

  it("rejects a payload missing required numbers", () => {
    const broken = structuredClone(listFixture) as { businesses: { last30: Record<string, unknown> }[] };
    delete broken.businesses[0].last30.leads;
    expect(mod.businessListSchema.safeParse(broken).success).toBe(false);
  });

  it("rejects a 1.2.0 detail response, which has no profile or links", () => {
    const old = structuredClone(detailFixture) as Record<string, unknown>;
    delete old.about;
    delete old.adminLinks;
    expect(mod.businessDetailSchema.safeParse(old).success).toBe(false);
  });

  it("reads the profile, links, subscriptions and newest leads", () => {
    const b = mod.businessDetailSchema.parse(detailFixture);
    expect(b.about?.cta).toEqual({ label: "Get leads", url: "https://leads.example.com/start" });
    expect(b.about?.questions).toHaveLength(2);
    expect(b.site?.importantLinks.map((l) => l.label)).toEqual(["cPanel", "status.example.net", "Monitoring"]);
    expect(b.site?.registrarLoginUrl).toBe("https://registrar.example/login");
    expect(b.spending?.subscriptions.map((s) => [s.name, s.monthly, s.loginUrl])).toEqual([
      ["Example Scheduler", 29, "https://scheduler.example/login"],
      ["Example Host", 10, null],
      ["Example Writer", 0, null],
    ]);
    expect(b.recentLeads[0]).toMatchObject({ name: "Sam Example", place: "Tacoma, WA" });
    expect(Object.keys(b.adminLinks)).toHaveLength(9);
  });

  it("never lets a non-http link through to an href", () => {
    const evil = structuredClone(detailFixture);
    evil.about.links.push({ label: "Bad", url: "javascript:alert(1)" });
    evil.about.cta = { label: "Bad", url: "javascript:alert(1)" };
    evil.about.questions[0].link = { label: "Bad", url: "data:text/html,hi" };
    evil.site.hostingLoginUrl = "javascript:alert(1)";
    evil.site.importantLinks.push({ label: "Bad", url: "vbscript:x" });
    evil.spending.subscriptions[0].loginUrl = "javascript:alert(1)";
    evil.topPosts[0].url = "javascript:alert(1)";
    (evil.adminLinks as Record<string, string>).leads = "javascript:alert(1)";

    const b = mod.businessDetailSchema.parse(evil);
    expect(JSON.stringify(b)).not.toMatch(/javascript:|data:text|vbscript:/);
    expect(b.about?.links).toHaveLength(2);
    expect(b.about?.cta).toBeNull();
    expect(b.about?.questions[0].link).toBeNull();
    expect(b.site?.hostingLoginUrl).toBeNull();
    expect(b.site?.importantLinks).toHaveLength(3);
    expect(b.adminLinks.leads).toBeUndefined();
  });
});

describe("client", () => {
  it("calls the endpoint with the key header and returns validated data", async () => {
    const fetchMock = respond(200, listFixture);
    vi.stubGlobal("fetch", fetchMock);
    const data = await mod.listBusinesses();
    expect(data.businesses.map((b) => b.slug)).toEqual(["example-leads", "paused-brand"]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${BASE}/businesses`); // trailing slash in the env var is trimmed
    expect((init.headers as Record<string, string>)["X-OS-Key"]).toBe(KEY);
    expect(init.cache).toBe("no-store");
  });

  it("returns null for an unknown business, and never requests a malformed slug", async () => {
    const fetchMock = respond(404, { code: "jdy_os_not_found", message: "No business with that slug.", data: { status: 404 } });
    vi.stubGlobal("fetch", fetchMock);
    expect(await mod.getBusiness("nope")).toBeNull();
    expect(await mod.getBusiness("../../wp-admin")).toBeNull();
    expect(await mod.getBusiness("Example_Leads")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    [401, { code: "jdy_os_unauthorized" }, "unauthorized"],
    [403, { code: "jdy_os_disabled" }, "disabled"],
    [429, { code: "jdy_os_locked" }, "locked"],
    [404, { code: "rest_no_route" }, "no_endpoint"],
    [500, { code: "internal_server_error" }, "unreachable"],
    [200, { businesses: "nope" }, "bad_response"],
  ])("maps HTTP %i (%o) to %s without leaking the key", async (status, body, code) => {
    vi.stubGlobal("fetch", respond(status, body));
    const result = await mod.settle(mod.listBusinesses);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(code);
      expect(result.error.message).not.toContain(KEY);
    }
  });

  it("reports an unreachable site by host only", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    const result = await mod.settle(mod.listBusinesses);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("unreachable");
      expect(result.error.message).toContain("wp.example");
      expect(result.error.message).not.toContain(KEY);
    }
  });

  it("lets unexpected programming errors through instead of hiding them", async () => {
    await expect(mod.settle(async () => { throw new RangeError("bug"); })).rejects.toThrow(RangeError);
  });
});

describe("live attention (OS Analytics adds only what JodyOS can't know)", () => {
  it("flags a lead drop of half or more, named the JodyOS way, but not on a tiny baseline", () => {
    const list = mod.businessListSchema.parse(structuredClone(listFixture));
    list.businesses[0].previous30.leads = 100;
    list.businesses[0].last30.leads = 42;
    const names = new Map([["example-leads", "Example Leads"]]);
    expect(mod.liveListAttention(list, names)).toMatchObject([{ title: "Example Leads: Leads down 58%", href: "/?b=example-leads&s=leads" }]);
    list.businesses[0].previous30.leads = 6;
    list.businesses[0].last30.leads = 1;
    expect(mod.liveListAttention(list)).toEqual([]);
  });

  it("ignores paused businesses and never repeats renewals (those come from JodyOS records)", () => {
    const list = mod.businessListSchema.parse(structuredClone(listFixture));
    expect(mod.liveListAttention(list)).toEqual([]); // the fixture has expired SSL, but that's not a live item
    list.businesses = list.businesses.map((b) => ({ ...b, active: false, previous30: { ...b.previous30, leads: 100 } }));
    expect(mod.liveListAttention(list)).toEqual([]);
  });

  it("inside a business: overdue tasks and failed posts", () => {
    const b = mod.businessDetailSchema.parse(structuredClone(detailFixture));
    expect(mod.liveAttention(b).map((i) => [i.title, i.href])).toEqual([
      ["2 overdue tasks", "/?b=example-leads&s=leads"],
      ["2 social posts failed to publish", "/?b=example-leads&s=marketing"],
    ]);
    b.tasks.overdue = 1;
    b.publisher!.failed = 0;
    expect(mod.liveAttention(b).map((i) => i.title)).toEqual(["1 overdue task"]);
  });
});
describe("formatting", () => {
  it("computes percent change, with no baseline as null", () => {
    expect(mod.percentChange(42, 30)).toBe(40);
    expect(mod.percentChange(15, 30)).toBe(-50);
    expect(mod.percentChange(0, 0)).toBe(0);
    expect(mod.percentChange(5, 0)).toBeNull();
  });

  it("formats money with symbols or ISO codes", () => {
    expect(mod.formatMoney(1234, "$")).toBe("$1,234");
    expect(mod.formatMoney(12.5, "$")).toBe("$12.50");
    expect(mod.formatMoney(29, "USD")).toBe("$29");
    expect(mod.formatMoney(-5, "$")).toBe("-$5");
  });
});

describe("environment", () => {
  it("trims the endpoint and requires https in production", () => {
    expect(parseEnv({ OS_ANALYTICS_URL: "https://wp.example/wp-json/jdy/v1/os///" }).OS_ANALYTICS_URL).toBe(
      "https://wp.example/wp-json/jdy/v1/os",
    );
    expect(() => parseEnv({ OS_ANALYTICS_URL: "ftp://wp.example" })).toThrow(EnvError);
    expect(() => parseEnv({ NODE_ENV: "production", OS_ANALYTICS_URL: "http://wp.example/x" })).toThrow(/https/);
    expect(parseEnv({ NODE_ENV: "development", OS_ANALYTICS_URL: "http://localhost:8080/x" }).OS_ANALYTICS_URL).toBe(
      "http://localhost:8080/x",
    );
  });
});
