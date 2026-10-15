import { describe, expect, it } from "vitest";
import { businessHref, editHref } from "@/lib/business-href";
import { formatDay, knowledgeSections, linkify, shortUrl } from "@/lib/business-view";

describe("dashboard URLs", () => {
  it("opens a business tab, or its edit page at one part", () => {
    expect(businessHref("example-leads")).toBe("/?b=example-leads");
    expect(editHref("example-leads")).toBe("/businesses/example-leads/edit");
    expect(editHref("example-leads", "websites")).toBe("/businesses/example-leads/edit#websites");
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

describe("words", () => {
  it("formats dates without a timezone shift", () => {
    expect(formatDay("2026-10-20")).toBe("20 Oct 2026");
    expect(formatDay(null)).toBeNull();
  });
});
