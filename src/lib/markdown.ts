/**
 * A deliberately small Markdown parser for chat answers. It produces plain
 * data (no HTML strings), so the renderer can't inject markup: React escapes
 * every text node. Handles what chat replies actually use: headings, lists,
 * fenced code, blockquotes, paragraphs, inline code, bold, italic and links.
 * An unclosed code fence (mid-stream) is treated as code to the end.
 */
export type Inline =
  | { type: "text"; text: string }
  | { type: "code"; text: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "link"; href: string; children: Inline[] };

export type Block =
  | { type: "heading"; level: 1 | 2 | 3; children: Inline[] }
  | { type: "paragraph"; children: Inline[] }
  | { type: "code"; lang: string; text: string }
  | { type: "list"; ordered: boolean; start: number; items: Inline[][] }
  | { type: "quote"; children: Inline[] }
  | { type: "rule" };

const SAFE_URL = /^(https?:\/\/|mailto:)/i;

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let text = "";
  const flush = () => {
    if (text) out.push({ type: "text", text });
    text = "";
  };
  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);
    let m: RegExpMatchArray | null;
    if ((m = rest.match(/^`([^`]+)`/))) {
      flush();
      out.push({ type: "code", text: m[1] });
      i += m[0].length;
    } else if ((m = rest.match(/^\*\*([^*]+(?:\*(?!\*)[^*]*)*)\*\*/)) || (m = rest.match(/^__([^_]+)__/))) {
      flush();
      out.push({ type: "strong", children: parseInline(m[1]) });
      i += m[0].length;
    } else if ((m = rest.match(/^\*([^*\s][^*]*?)\*/)) || (m = rest.match(/^_([^_\s][^_]*?)_(?![A-Za-z0-9])/))) {
      flush();
      out.push({ type: "em", children: parseInline(m[1]) });
      i += m[0].length;
    } else if ((m = rest.match(/^\[([^\]]+)\]\(([^)\s]+)\)/))) {
      flush();
      if (SAFE_URL.test(m[2])) {
        out.push({ type: "link", href: m[2], children: parseInline(m[1]) });
      } else {
        out.push({ type: "text", text: m[1] });
      }
      i += m[0].length;
    } else {
      text += src[i];
      i += 1;
    }
  }
  flush();
  return out;
}

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) blocks.push({ type: "paragraph", children: parseInline(para.join("\n")) });
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m: RegExpMatchArray | null;

    if ((m = line.match(/^\s*```\s*([\w+-]*)\s*$/))) {
      flushPara();
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) code.push(lines[i++]);
      blocks.push({ type: "code", lang: m[1] ?? "", text: code.join("\n") });
      continue;
    }
    if (!line.trim()) {
      flushPara();
      continue;
    }
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
      flushPara();
      const level = Math.min(m[1].length, 3) as 1 | 2 | 3;
      blocks.push({ type: "heading", level, children: parseInline(m[2].replace(/\s+#+\s*$/, "")) });
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flushPara();
      blocks.push({ type: "rule" });
      continue;
    }
    if (/^\s*>/.test(line)) {
      flushPara();
      const quote: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ""));
      i--;
      blocks.push({ type: "quote", children: parseInline(quote.join("\n")) });
      continue;
    }
    const bullet = /^\s*[-*+]\s+(.*)$/;
    const numbered = /^\s*(\d+)[.)]\s+(.*)$/;
    if (bullet.test(line) || numbered.test(line)) {
      flushPara();
      const ordered = numbered.test(line);
      const start = ordered ? Number(line.match(numbered)![1]) : 1;
      const items: string[] = [];
      while (i < lines.length) {
        const l = lines[i];
        const item = ordered ? l.match(numbered) : l.match(bullet);
        if (item) {
          items.push(ordered ? item[2] : item[1]);
        } else if (/^\s{2,}\S/.test(l) && items.length) {
          items[items.length - 1] += `\n${l.trim()}`;
        } else {
          break;
        }
        i++;
      }
      i--;
      blocks.push({ type: "list", ordered, start, items: items.map(parseInline) });
      continue;
    }
    para.push(line);
  }
  flushPara();
  return blocks;
}
