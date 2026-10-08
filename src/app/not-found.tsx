import Link from "next/link";
import { Panel, buttonClass } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <Panel className="w-full max-w-md p-8 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">404</p>
        <h1 className="mt-2 text-xl font-semibold">Nothing here</h1>
        <p className="mt-2 text-sm text-muted">That page doesn&apos;t exist in JodyOS.</p>
        <Link href="/" className={buttonClass("primary", "mt-6")}>
          Back to the dashboard
        </Link>
      </Panel>
    </div>
  );
}
