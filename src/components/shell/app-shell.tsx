"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { MODULE_GROUPS, MODULES, PHASES, type ModuleDef } from "@/lib/modules";
import { Wordmark } from "@/components/ui/logo";
import { cx } from "@/components/ui/primitives";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

const READY = MODULES.filter((m) => m.phase === 1);
const LATER = MODULES.filter((m) => m.phase > 1);

function NavLink({ m, activePath, onNavigate }: { m: ModuleDef; activePath: string | null; onNavigate?: () => void }) {
  const active = activePath !== null && isActive(activePath, m.href);
  return (
    <li>
      <Link
        href={m.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cx(
          "flex min-h-10 items-center justify-between gap-3 rounded-xl px-3 text-[15px] transition-colors duration-200",
          active ? "bg-ink font-semibold text-paper" : "hover:bg-wash",
        )}
      >
        <span className="truncate">{m.label}</span>
        {m.phase > 1 ? <span className={cx("text-xs", active ? "text-paper" : "text-subtle")}>{PHASES[m.phase]}</span> : null}
      </Link>
    </li>
  );
}

/**
 * What works today comes first, by group. Pages still to be built sit under
 * "Coming later" so they don't get in the way; it opens by itself when one
 * of them is the current page.
 */
function NavGroups({ activePath, onNavigate }: { activePath: string | null; onNavigate?: () => void }) {
  const onLaterPage = activePath !== null && LATER.some((m) => isActive(activePath, m.href));
  return (
    <>
      {MODULE_GROUPS.map((group) => {
        const mods = READY.filter((m) => m.group === group);
        if (!mods.length) return null;
        return (
          <div key={group} className="mb-5 px-3">
            <p className="label mb-1.5 px-3 text-subtle">{group}</p>
            <ul className="space-y-0.5">
              {mods.map((m) => (
                <NavLink key={m.id} m={m} activePath={activePath} onNavigate={onNavigate} />
              ))}
            </ul>
          </div>
        );
      })}
      <details className="group/later mb-5 px-3" open={onLaterPage || undefined}>
        <summary className="label flex min-h-9 cursor-pointer list-none items-center justify-between rounded-xl px-3 text-subtle hover:bg-wash [&::-webkit-details-marker]:hidden">
          Coming later
          <span aria-hidden="true" className="text-sm transition-transform duration-200 group-open/later:rotate-90">
            ›
          </span>
        </summary>
        <ul className="mt-1 space-y-0.5">
          {LATER.map((m) => (
            <NavLink key={m.id} m={m} activePath={activePath} onNavigate={onNavigate} />
          ))}
        </ul>
      </details>
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
      <div className="flex h-16 shrink-0 items-center px-6">
        <Link href="/" onClick={onNavigate} aria-label="JodyOS dashboard">
          <Wordmark />
        </Link>
      </div>

      <nav className="no-scrollbar flex-1 overflow-y-auto py-4" aria-label="Main">
        <Suspense fallback={<NavGroups activePath={null} onNavigate={onNavigate} />}>
          <ActiveNav onNavigate={onNavigate} />
        </Suspense>
      </nav>

      <div className="m-3 shrink-0 rounded-2xl bg-wash">{userSlot}</div>
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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-hair bg-paper lg:block">
        <SidebarContent userSlot={userSlot} />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-hair bg-paper/90 px-4 backdrop-blur lg:hidden">
        <Link href="/" aria-label="JodyOS dashboard">
          <Wordmark />
        </Link>
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setOpen(true)}
          className="min-h-10 rounded-full bg-wash px-4 text-sm font-semibold transition-colors hover:bg-mist"
          aria-expanded={open}
        >
          Menu
        </button>
      </header>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 animate-fade bg-ink/40" onClick={close} aria-hidden="true" />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 w-[min(18rem,85vw)] animate-slide-in rounded-r-3xl bg-paper"
          >
            <button
              type="button"
              onClick={close}
              className="absolute right-4 top-3 z-10 min-h-10 rounded-full bg-wash px-4 text-sm font-semibold transition-colors hover:bg-mist"
            >
              Close
            </button>
            {/* Following a link closes the drawer. */}
            <SidebarContent userSlot={userSlot} onNavigate={close} />
          </div>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 lg:px-12 lg:py-12">{children}</main>
      </div>
    </div>
  );
}
