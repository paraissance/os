"use client";

import { useEffect, useState } from "react";
import { buttonClass } from "@/components/ui/primitives";

/** Copies a snippet; says so for two seconds. */
export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        });
      }}
      className={buttonClass("primary", "min-h-9 px-4")}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/**
 * Loads the real website widget (/agent.js) on this page, open, and removes
 * it again when the page is left, so it doesn't follow you around JodyOS.
 */
export function TryAgent({ slug }: { slug: string }) {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "/agent.js";
    script.defer = true;
    script.dataset.agent = slug;
    script.dataset.open = "";
    document.body.appendChild(script);
    return () => {
      script.remove();
      document.querySelectorAll(`[data-jodyos-agent="${slug}"]`).forEach((n) => n.remove());
      delete (window as unknown as Record<string, unknown>)[`__jodyosAgent_${slug}`];
    };
  }, [slug]);
  return null;
}
