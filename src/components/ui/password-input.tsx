"use client";

import { useState, type ComponentProps } from "react";
import { Input, cx } from "@/components/ui/primitives";

/** A password field with a Show / Hide button inside it. */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className={cx("pr-20", className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-controls={props.id}
        aria-pressed={visible}
        className="absolute inset-y-1.5 right-1.5 rounded-lg px-3 text-xs font-semibold text-muted transition-colors hover:bg-wash hover:text-ink"
      >
        {visible ? "Hide" : "Show"}
        <span className="sr-only"> password</span>
      </button>
    </div>
  );
}
