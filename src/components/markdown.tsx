import { Fragment } from "react";
import { parseMarkdown, type Block, type Inline } from "@/lib/markdown";

function InlineNodes({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.type) {
          case "text":
            return <Fragment key={i}>{n.text}</Fragment>;
          case "code":
            return (
              <code key={i} className="rounded-md border border-line bg-white/[0.05] px-1.5 py-0.5 font-mono text-[0.85em] text-fg">
                {n.text}
              </code>
            );
          case "strong":
            return (
              <strong key={i} className="font-semibold text-fg">
                <InlineNodes nodes={n.children} />
              </strong>
            );
          case "em":
            return (
              <em key={i}>
                <InlineNodes nodes={n.children} />
              </em>
            );
          case "link":
            return (
              <a key={i} href={n.href} target="_blank" rel="noopener noreferrer nofollow" className="text-accent underline underline-offset-4">
                <InlineNodes nodes={n.children} />
              </a>
            );
        }
      })}
    </>
  );
}

function BlockNode({ block }: { block: Block }) {
  switch (block.type) {
    case "heading": {
      const cls = "font-semibold text-fg mt-5 first:mt-0";
      if (block.level === 1) return <h3 className={`${cls} text-lg`}><InlineNodes nodes={block.children} /></h3>;
      if (block.level === 2) return <h4 className={`${cls} text-base`}><InlineNodes nodes={block.children} /></h4>;
      return <h5 className={`${cls} text-[15px]`}><InlineNodes nodes={block.children} /></h5>;
    }
    case "paragraph":
      return (
        <p className="whitespace-pre-wrap">
          <InlineNodes nodes={block.children} />
        </p>
      );
    case "code":
      return (
        <pre className="overflow-x-auto rounded-xl border border-line bg-ink-950/80 p-4 font-mono text-[13px] leading-relaxed text-fg">
          <code>{block.text}</code>
        </pre>
      );
    case "list": {
      const items = block.items.map((item, i) => (
        <li key={i} className="whitespace-pre-wrap pl-1">
          <InlineNodes nodes={item} />
        </li>
      ));
      return block.ordered ? (
        <ol start={block.start} className="list-decimal space-y-1 pl-5 marker:text-subtle">
          {items}
        </ol>
      ) : (
        <ul className="list-disc space-y-1 pl-5 marker:text-subtle">{items}</ul>
      );
    }
    case "quote":
      return (
        <blockquote className="whitespace-pre-wrap border-l-2 border-accent/50 pl-4 text-muted">
          <InlineNodes nodes={block.children} />
        </blockquote>
      );
    case "rule":
      return <hr className="border-line" />;
  }
}

export function Markdown({ text }: { text: string }) {
  const blocks = parseMarkdown(text);
  return (
    <div className="space-y-3 text-[15px] leading-relaxed text-fg/90">
      {blocks.map((b, i) => (
        <BlockNode key={i} block={b} />
      ))}
    </div>
  );
}
