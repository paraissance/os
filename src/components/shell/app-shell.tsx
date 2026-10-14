"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { Wordmark } from "@/components/ui/logo";
import { cx } from "@/components/ui/primitives";

/**
 * The main places, nothing more. Everything else (Activity, Integrations and
 * the pages still to come) lives under Others. `also` lists pages that belong
 * to a place without being its address (AI Command is part of AI & Analytics).
 */
const NAV: { href: string; label: string; also?: string[] }[] = [
  { href: "/", label: "Dashboard" },
  { href: "/businesses", label: "Businesses" },
  { href: "/websites", label: "Websites" },
  { href: "/social", label: "Social Media" },
  { href: "/spending", label: "Spending" },
  { href: "/analytics", label: "AI & Analytics", also: ["/command"] },
  { href: "/others", label: "Others" },
  { href: "/settings", label: "Settings" },
];

function under(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function isActive(pathname: string, href: string) {
  if (href === "/others") {
    // Any page that isn't one of the other main places belongs to Others.
    return !NAV.some((n) => n.href !== "/others" && [n.href, ...(n.also ?? [])].some((h) => under(pathname, h)));
  }
  const item = NAV.find((n) => n.href === href);
  return [href, ...(item?.also ?? [])].some((h) => under(pathname, h));
}

function NavGroups({ activePath, onNavigate }: { activePath: string | null; onNavigate?: () => void }) {
  return (
    <ul className="space-y-1 px-3">
      {NAV.map((item) => {
        const active = activePath !== null && isActive(activePath, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex min-h-11 items-center rounded-xl px-4 text-base transition-colors duration-200",
                active ? "bg-ink font-semibold text-paper" : "hover:bg-wash",
              )}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
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
