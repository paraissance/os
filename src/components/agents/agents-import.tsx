"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { importAgentsAction } from "@/app/actions/agents";
import { Alert, cx } from "@/components/ui/primitives";

/** Pick or drop the agents file; it imports straight away. */
export function AgentsImport() {
  const [state, run, pending] = useActionState(importAgentsAction, undefined);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);

  function picked(files: FileList | null) {
    const file = files?.[0];
    setFileName(file?.name ?? null);
    if (file && form.current) {
      const data = new FormData(form.current);
      startTransition(() => run(data));
    }
  }

  return (
    <form ref={form} onSubmit={(e) => e.preventDefault()} className="space-y-4">
      {state?.error ? (
        <Alert tone="bad">
          <span className="whitespace-pre-line">{state.error}</span>
        </Alert>
      ) : null}
      {state?.message ? <Alert tone="ok">{state.message}</Alert> : null}
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!input.current || !e.dataTransfer.files.length) return;
          input.current.files = e.dataTransfer.files;
          picked(e.dataTransfer.files);
        }}
        className={cx(
          "flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed bg-paper px-5 py-6 text-center transition-[border-color,background-color,transform] duration-200 hover:border-ink",
          dragging ? "scale-[1.01] border-ink bg-wash" : "border-line",
        )}
      >
        <span className="text-lg font-bold">{pending ? "Importing…" : dragging ? "Drop it here" : "Choose or drop the agents file"}</span>
        <span className="text-sm text-muted">{pending ? `Reading ${fileName ?? "the file"}.` : "jodyos-agents.zip (or .json), made from the OS Analytics plugin."}</span>
        <input
          ref={input}
          type="file"
          name="file"
          accept=".zip,application/zip,application/x-zip-compressed,.json,application/json"
          className="sr-only"
          onChange={(e) => picked(e.target.files)}
        />
      </label>
    </form>
  );
}
