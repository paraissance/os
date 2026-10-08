"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { MODULE_GROUPS, MODULES } from "@/lib/modules";
import { Wordmark } from "@/components/ui/logo";
import { cx } from "@/components/ui/primitives";
import { NAV_ICONS } from "./nav-icons";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarContent({ userSlot, gradientId }: { userSlot: ReactNode; gradientId: string }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Link href="/" className="rounded-lg" aria-label="JodyOS dashboard">
          <Wordmark gradientId={gradientId} />
        </Link>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4" aria-label="Main">
        {MODULE_GROUPS.map((group) => (
          <div key={group}>
            <p className="mb-1.5 px-3 font-mono text-[11px] uppercase tracking-[0.16em] text-subtle">{group}</p>
            <ul className="space-y-0.5">
              {MODULES.filter((m) => m.group === group).map((m) => {
                const Icon = NAV_ICONS[m.id];
                const active = isActive(pathname, m.href);
                return (
                  <li key={m.id}>
                    <Link
                      href={m.href}
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "group relative flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors",
                        active ? "bg-white/[0.07] text-fg" : "text-muted hover:bg-white/[0.04] hover:text-fg",
                      )}
                    >
                      {active ? (
                        <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-gradient-to-b from-accent to-violet" />
                      ) : null}
                      <Icon className={cx("size-4 shrink-0", active ? "text-accent" : "text-subtle group-hover:text-muted")} />
                      <span className="flex-1 truncate">{m.label}</span>
                      {m.phase > 1 ? (
                        <span
                          className="rounded-md border border-line px-1.5 py-px font-mono text-[10px] text-subtle"
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
      </nav>

      <div className="border-t border-line p-3">{userSlot}</div>
    </div>
  );
}

export function AppShell({ children, userSlot }: { children: ReactNode; userSlot: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Close the drawer whenever the route changes.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-ink-900/70 backdrop-blur-xl lg:block">
        <SidebarContent userSlot={userSlot} gradientId="sidebar" />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-ink-950/80 px-4 backdrop-blur-xl lg:hidden">
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setOpen(true)}
          className="-ml-1 inline-flex size-11 items-center justify-center rounded-xl text-muted hover:bg-white/[0.06] hover:text-fg"
          aria-label="Open navigation"
          aria-expanded={open}
        >
          <Menu className="size-5" />
        </button>
        <Link href="/" aria-label="JodyOS dashboard">
          <Wordmark gradientId="topbar" />
        </Link>
      </header>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 w-[min(18rem,85vw)] border-r border-line bg-ink-900 shadow-2xl animate-fade-up"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-2 top-2.5 z-10 inline-flex size-11 items-center justify-center rounded-xl text-muted hover:bg-white/[0.06] hover:text-fg"
              aria-label="Close navigation"
            >
              <X className="size-5" />
            </button>
            <SidebarContent userSlot={userSlot} gradientId="drawer" />
          </div>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
