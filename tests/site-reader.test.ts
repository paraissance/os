import { describe, expect, it } from "vitest";
import { pageText, sitePages, siteKnowledgeText } from "@/lib/site-reader";

describe("reading a website", () => {
  it("keeps a page's words, without menus, footers, forms or scripts", () => {
    const html = `<html><head><title>Example Leads &amp; More</title><script>var x = 1;</script></head><body>
      <header><a href="/">Home</a></header><nav><a href="/about">About</a></nav>
      <main><h1>Leads that convert</h1><p>We find buyer&nbsp;and seller leads.</p><p>We find buyer and seller leads.</p>
      <div>Call 555&#8209;0100 &rsquo;today&rsquo;</div><form><label>Email</label><button>Send</button></form></main>
      <footer>© Example</footer><!-- hidden --></body></html>`;
    expect(pageText(html)).toEqual({
      title: "Example Leads & More",
      text: "Leads that convert\nWe find buyer and seller leads.\nCall 555‑0100 ’today’",
    });
  });

  it("follows only the site's own pages, each once, leaving out logins, carts and files", () => {
    const home = new URL("https://www.example.com/");
    expect(
      sitePages(
        ["/", "/about/", "https://example.com/about", "/pricing?ref=nav#top", "https://other.example/x", "/checkout", "/brochure.pdf", "mailto:a@b.c", "/blog/post-1"],
        home,
      ),
    ).toEqual(["https://www.example.com/", "https://www.example.com/about", "https://www.example.com/pricing", "https://www.example.com/blog/post-1"]);
  });

  it("labels each page and drops lines already said on an earlier page", () => {
    const text = siteKnowledgeText([
      { url: "https://example.com/", title: "Home", text: "Menu item\nWe find leads." },
      { url: "https://example.com/pricing", title: "Pricing", text: "Menu item\nPlans start at $99." },
      { url: "https://example.com/copy", title: "Copy", text: "Menu item\nWe find leads." },
    ]);
    expect(text).toBe("# PAGE: Home (https://example.com/)\nMenu item\nWe find leads.\n\n# PAGE: Pricing (https://example.com/pricing)\nPlans start at $99.");
  });
});
