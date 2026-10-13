import { describe, expect, it } from "vitest";
import detailFixture from "./fixtures/os-analytics-business-example-leads.json";
import { businessHref, isSection } from "@/lib/business-sections";
import { cycleLabel, formatDay, formatWhen, funnelSteps, humanize, knowledgeSections, leadStatusLabel, linkify, shortUrl } from "@/lib/business-view";
import { businessDetailSchema } from "@/lib/os-analytics";

const detail = () => businessDetailSchema.parse(structuredClone(detailFixture));

describe("dashboard URLs", () => {
  it("opens a business on Summary unless another section is named", () => {
    expect(businessHref("example-leads")).toBe("/?b=example-leads");
    expect(businessHref("example-leads", "summary")).toBe("/?b=example-leads");
    expect(businessHref("example-leads", "money")).toBe("/?b=example-leads&s=money");
  });

  it("accepts only known sections", () => {
    expect(isSection("links")).toBe(true);
    expect(isSection("admin")).toBe(false);
    expect(isSection(undefined)).toBe(false);
  });
});

describe("about text", () => {
  it("splits the profile into headed sections, one fact per line", () => {
    const sections = knowledgeSections("Intro line\n# ABOUT\nFirst fact.\n\nSecond fact.\n# EMPTY\n# ADDITIONAL KNOWLEDGE (added by admin)\nOpen weekdays.");
    expect(sections).toEqual([
      { heading: null, lines: ["Intro line"] },
      { heading: "ABOUT", lines: ["First fact.", "Second fact."] },
      { heading: "Added in OS Analytics", lines: ["Open weekdays."] },
    ]);
    expect(knowledgeSections(null)).toEqual([]);
  });

  it("makes URLs in prose clickable without swallowing punctuation", () => {
    expect(linkify("Site: https://a.example/x. More at http://b.example")).toEqual([
      { text: "Site: " },
      { url: "https://a.example/x" },
      { text: ". More at " },
      { url: "http://b.example" },
    ]);
    expect(linkify("javascript:alert(1)")).toEqual([{ text: "javascript:alert(1)" }]);
  });
});

describe("links", () => {
  it("shortens addresses for display", () => {
    expect(shortUrl("https://www.leads.example.com/")).toBe("leads.example.com");
    expect(shortUrl("https://leads.example.com/pricing/")).toBe("leads.example.com/pricing");
    expect(shortUrl("https://wp.example/wp-admin/admin.php?page=jdy-leads&brand=4")).toBe("wp.example/wp-admin/admin.php?page=jdy-leads&brand=4");
    expect(shortUrl("not a url")).toBe("not a url");
  });
});

describe("words", () => {  it("formats dates without a timezone shift, and times in the owner's timezone", () => {
    expect(formatDay("2026-10-20")).toBe("20 Oct 2026");
    expect(formatDay(null)).toBeNull();
    expect(formatWhen("2026-10-11T16:00:00+00:00", "America/Los_Angeles")).toMatch(/^Sun,? 11 Oct,? 09:00$/);
    expect(formatWhen("2026-10-11T23:30:00+00:00", "Europe/London")).toMatch(/^Mon,? 12 Oct,? 00:30$/);
    expect(formatWhen(null, "UTC")).toBeNull();
  });

  it("labels cycles, statuses and sources", () => {
    expect(cycleLabel("yearly")).toBe("a year");
    expect(cycleLabel("one_time")).toBe("one-time");
    expect(cycleLabel("every_week")).toBe("every week");
    expect(leadStatusLabel("appointment")).toBe("Appointment set");
    expect(leadStatusLabel("on_hold")).toBe("On hold");
    expect(humanize("facebook_lead_ads")).toBe("Facebook lead ads");
    expect(humanize("contact-form-7")).toBe("Contact form 7");
  });
});

describe("numbers", () => {
  it("builds the funnel with the share of each step before", () => {
    const steps = funnelSteps(detail().funnel);
    expect(steps.map((s) => [s.label, s.value, s.rate, s.of])).toEqual([
      ["Seen", 5000, null, null],
      ["Clicked", 240, 4.8, "views"],
      ["Became leads", 42, 17.5, "clicks"],
      ["Booked", 6, 14.3, "leads"],
      ["Loans funded", 1, 16.7, "bookings"],
    ]);
  });

  it("drops the loans step when there are none, and never divides by zero", () => {
    const steps = funnelSteps({ impressions: 0, clicks: 3, leads: 0, appointments: 0, loansFunded: 0 });
    expect(steps.map((s) => s.rate)).toEqual([null, null, 0, null]);
  });

});
