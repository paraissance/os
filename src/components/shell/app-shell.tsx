"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { MODULE_GROUPS, MODULES } from "@/lib/modules";
import { Wordmark } from "@/components/ui/logo";
import { cx } from "@/components/ui/primitives";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Index numbers follow the module order, so the nav reads like a contents page. */
const INDEX = new Map(MODULES.map((m, i) => [m.id, String(i + 1).padStart(2, "0")]));

function NavGroups({ activePath, onNavigate }: { activePath: string | null; onNavigate?: () => void }) {
  return (
    <>
      {MODULE_GROUPS.map((group) => (
        <div key={group} className="mb-5">
          <p className="label mb-1.5 px-5 text-subtle">{group}</p>
          <ul>
            {MODULES.filter((m) => m.group === group).map((m) => {
              const active = activePath !== null && isActive(activePath, m.href);
              return (
                <li key={m.id}>
                  <Link
                    href={m.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cx(
                      "flex min-h-10 items-center gap-3 px-5 text-[15px] transition-colors",
                      active ? "bg-ink font-semibold text-paper" : "hover:bg-wash",
                    )}
                  >
                    <span className={cx("w-5 font-mono text-[11px] tabular-nums", active ? "text-paper" : "text-subtle")}>
                      {INDEX.get(m.id)}
                    </span>
                    <span className="flex-1 truncate">{m.label}</span>
                    {m.phase > 1 ? (
                      <span
                        className={cx("font-mono text-[11px]", active ? "text-paper" : "text-subtle")}
                        title={`Arrives in Phase ${m.phase}`}
                      >
                        P{m.phase}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </>
  );
}

/**
 * Reads the current path. On pages with a dynamic segment the path is
 * request-time data, so it sits behind its own Suspense boundary:
 * the plain nav is part of the instant static shell and the highlight streams in.
 */
function ActiveNav({ onNavigate }: { onNavigate?: () => void }) {
  return <NavGroups activePath={usePathname()} onNavigate={onNavigate} />;
}

function SidebarContent({ userSlot, onNavigate }: { userSlot: ReactNode; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center border-b border-ink px-5">
        <Link href="/" onClick={onNavigate} aria-label="JodyOS dashboard">
          <Wordmark />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto py-5" aria-label="Main">
        <Suspense fallback={<NavGroups activePath={null} onNavigate={onNavigate} />}>
          <ActiveNav onNavigate={onNavigate} />
        </Suspense>
      </nav>

      <div className="shrink-0 border-t border-ink">{userSlot}</div>
    </div>
  );
}

export function AppShell({ children, userSlot }: { children: ReactNode; userSlot: ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const close = () => setOpen(false);

  // Ctrl/Cmd+K jumps to AI Command from anywhere.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        router.push("/command");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  useEffect(() => {
    if (!open) return;
    const button = menuButtonRef.current;
    document.body.style.overflow = "hidden";
    drawerRef.current?.querySelector<HTMLElement>("a,button")?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      button?.focus();
    };
  }, [open]);

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-ink bg-paper lg:block">
        <SidebarContent userSlot={userSlot} />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-ink bg-paper px-4 lg:hidden">
        <Link href="/" aria-label="JodyOS dashboard">
          <Wordmark />
        </Link>
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setOpen(true)}
          className="min-h-11 px-1 text-sm font-semibold underline decoration-1 underline-offset-4"
          aria-expanded={open}
        >
          Menu
        </button>
      </header>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={close} aria-hidden="true" />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 w-[min(18rem,85vw)] border-r border-ink bg-paper"
          >
            <button
              type="button"
              onClick={close}
              className="absolute right-4 top-2.5 z-10 min-h-11 px-1 text-sm font-semibold underline decoration-1 underline-offset-4"
            >
              Close
            </button>
            {/* Following a link closes the drawer. */}
            <SidebarContent userSlot={userSlot} onNavigate={close} />
          </div>
        </div>
      ) : null}

      <div className="lg:pl-60">
        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 lg:px-12 lg:py-12">{children}</main>
      </div>
    </div>
  );
}
