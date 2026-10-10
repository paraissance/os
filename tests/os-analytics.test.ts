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

describe("attention items", () => {
  const today = new Date("2026-10-10T12:00:00Z");

  it("flags expired and expiring renewals and near subscription renewals, critical first", () => {
    const items = mod.businessAttention(mod.businessListSchema.parse(listFixture), today);
    expect(items.map((i) => [i.level, i.title])).toEqual([
      ["critical", "Example Leads Co: SSL certificate expired"],
      ["warning", "Example Scheduler renews in 5 days"],
      ["warning", "Example Leads Co: Domain expires in 10 days"],
    ]);
    expect(items[0].href).toBe("/businesses/example-leads");
  });

  it("flags a lead drop of half or more, but not on a tiny baseline", () => {
    const list = mod.businessListSchema.parse(structuredClone(listFixture));
    list.spending = null;
    list.businesses[0].renewals = [];
    list.businesses[0].previous30.leads = 100;
    list.businesses[0].last30.leads = 42;
    expect(mod.businessAttention(list, today).map((i) => i.title)).toEqual(["Example Leads Co: leads down 58%"]);
    list.businesses[0].previous30.leads = 6;
    list.businesses[0].last30.leads = 1;
    expect(mod.businessAttention(list, today)).toEqual([]);
  });

  it("ignores paused businesses", () => {
    const list = mod.businessListSchema.parse(structuredClone(listFixture));
    list.spending = null;
    list.businesses = list.businesses.map((b) => ({ ...b, active: false }));
    expect(mod.businessAttention(list, today)).toEqual([]);
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
