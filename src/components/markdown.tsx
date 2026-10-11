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
              <code key={i} className="rounded-md bg-wash px-1 py-0.5 font-mono text-[0.86em]">
                {n.text}
              </code>
            );
          case "strong":
            return (
              <strong key={i} className="font-bold">
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
              <a key={i} href={n.href} target="_blank" rel="noopener noreferrer nofollow" className="underline decoration-1 underline-offset-4 hover:decoration-2">
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
      const cls = "mt-6 font-bold tracking-[-0.02em] first:mt-0";
      if (block.level === 1) return <h3 className={`${cls} text-xl`}><InlineNodes nodes={block.children} /></h3>;
      if (block.level === 2) return <h4 className={`${cls} text-lg`}><InlineNodes nodes={block.children} /></h4>;
      return <h5 className={`${cls} text-base`}><InlineNodes nodes={block.children} /></h5>;
    }
    case "paragraph":
      return (
        <p className="whitespace-pre-wrap">
          <InlineNodes nodes={block.children} />
        </p>
      );
    case "code":
      return (
        <pre className="overflow-x-auto rounded-xl bg-wash p-4 font-mono text-[13px] leading-relaxed">
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
        <ol start={block.start} className="list-decimal space-y-1 pl-6">
          {items}
        </ol>
      ) : (
        <ul className="list-[square] space-y-1 pl-6">{items}</ul>
      );
    }
    case "quote":
      return (
        <blockquote className="whitespace-pre-wrap rounded-r-xl border-l-4 border-ink bg-wash py-2 pl-4 pr-3 text-muted">
          <InlineNodes nodes={block.children} />
        </blockquote>
      );
    case "rule":
      return <hr className="border-hair" />;
  }
}

export function Markdown({ text }: { text: string }) {
  const blocks = parseMarkdown(text);
  return (
    <div className="space-y-3 text-[15px] leading-relaxed">
      {blocks.map((b, i) => (
        <BlockNode key={i} block={b} />
      ))}
    </div>
  );
}
