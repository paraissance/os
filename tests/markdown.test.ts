import { describe, expect, it } from "vitest";
import { parseInline, parseMarkdown } from "@/lib/markdown";
import { parseChatEvents } from "@/lib/chat-events";

describe("markdown parser", () => {
  it("parses the block types chat answers use", () => {
    const blocks = parseMarkdown(
      ["# Plan", "", "Intro **bold** and `code`.", "", "- one", "- two", "", "1. first", "2. second", "", "> quoted", "", "```ts", "const x = 1;", "```", "", "---"].join("\n"),
    );
    expect(blocks.map((b) => b.type)).toEqual(["heading", "paragraph", "list", "list", "quote", "code", "rule"]);
    expect(blocks[2]).toMatchObject({ ordered: false, items: [[{ type: "text", text: "one" }], [{ type: "text", text: "two" }]] });
    expect(blocks[3]).toMatchObject({ ordered: true, start: 1 });
    expect(blocks[5]).toEqual({ type: "code", lang: "ts", text: "const x = 1;" });
  });

  it("treats an unclosed fence (mid-stream) as code to the end", () => {
    const blocks = parseMarkdown("Here:\n```\nline 1\nline 2");
    expect(blocks.at(-1)).toEqual({ type: "code", lang: "", text: "line 1\nline 2" });
  });

  it("only links http(s) and mailto URLs", () => {
    expect(parseInline("[ok](https://example.com)")[0]).toMatchObject({ type: "link", href: "https://example.com" });
    expect(parseInline("[bad](javascript:alert(1))")[0]).toEqual({ type: "text", text: "bad" });
    expect(parseInline("[data](data:text/html,x)")[0]).toEqual({ type: "text", text: "data" });
  });

  it("keeps raw HTML as text (React escapes it)", () => {
    expect(parseMarkdown("<img src=x onerror=alert(1)>")).toEqual([
      { type: "paragraph", children: [{ type: "text", text: "<img src=x onerror=alert(1)>" }] },
    ]);
  });

  it("doesn't italicise snake_case words", () => {
    expect(parseInline("use my_var_name here")).toEqual([{ type: "text", text: "use my_var_name here" }]);
  });
});

describe("chat event stream parsing", () => {
  it("splits complete lines and keeps the unfinished remainder", () => {
    const { events, rest } = parseChatEvents('{"type":"meta","conversationId":"c1"}\n{"type":"text","text":"Hi"}\n{"type":"te');
    expect(events).toEqual([
      { type: "meta", conversationId: "c1" },
      { type: "text", text: "Hi" },
    ]);
    expect(rest).toBe('{"type":"te');
  });

  it("skips malformed lines instead of failing", () => {
    expect(parseChatEvents('garbage\n{"type":"done","stopReason":null,"model":"m"}\n').events).toEqual([
      { type: "done", stopReason: null, model: "m" },
    ]);
  });
});
