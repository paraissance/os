"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { Wordmark } from "@/components/ui/logo";
import { cx } from "@/components/ui/primitives";
import { NAV_KEY } from "./nav-state";

/**
 * The main places, nothing more. Everything else (Activity, Integrations and
 * the pages still to come) lives under Others. `also` lists pages that belong
 * to a place without being its address (AI Command is part of AI & Analytics).
 * `icon` is the inside of a 24×24 line icon, all the folded rail shows.
 */
const NAV: { href: string; label: string; icon: ReactNode; also?: string[] }[] = [
  {
    href: "/",
    label: "Dashboard",
    icon: (
      <>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </>
    ),
  },
  {
    href: "/businesses",
    label: "Businesses",
    icon: (
      <>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" />
      </>
    ),
  },
  {
    href: "/websites",
    label: "Websites",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </>
    ),
  },
  {
    href: "/social",
    label: "Social Media",
    icon: (
      <>
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
      </>
    ),
  },
  {
    href: "/spending",
    label: "Spendings",
    icon: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20M6 15h4" />
      </>
    ),
  },
  { href: "/analytics", label: "AI & Analytics", also: ["/command"], icon: <path d="M3 3v18h18M7 15l4-4 3 3 5-6" /> },
  {
    href: "/others",
    label: "Others",
    icon: (
      <>
        <circle cx="5" cy="12" r="1.2" fill="currentColor" />
        <circle cx="12" cy="12" r="1.2" fill="currentColor" />
        <circle cx="19" cy="12" r="1.2" fill="currentColor" />
      </>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (
      <>
        <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
        <circle cx="15" cy="6" r="2" />
        <circle cx="9" cy="12" r="2" />
        <circle cx="17" cy="18" r="2" />
      </>
    ),
  },
];

function Icon({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cx("size-5 shrink-0", className)}
    >
      {children}
    </svg>
  );
}

/* The folded rail lives on <html> (data-nav), so the head script can apply it before the first paint. */
const NAV_EVENT = "jodyos-nav";
const railClosed = () => document.documentElement.dataset.nav === "closed";
function onRailChange(notify: () => void) {
  window.addEventListener(NAV_EVENT, notify);
  return () => window.removeEventListener(NAV_EVENT, notify);
}
function toggleRail() {
  const html = document.documentElement;
  if (railClosed()) delete html.dataset.nav;
  else html.dataset.nav = "closed";
  try {
    localStorage.setItem(NAV_KEY, html.dataset.nav ?? "open");
  } catch {
    // Private windows may refuse storage; the rail still folds for this visit.
  }
  window.dispatchEvent(new Event(NAV_EVENT));
}

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

type NavProps = { rail?: boolean; onNavigate?: () => void };

function NavGroups({ activePath, rail, onNavigate }: NavProps & { activePath: string | null }) {
  return (
    <ul className="space-y-1 px-3 lg:my-auto">
      {NAV.map((item, i) => {
        const active = activePath !== null && isActive(activePath, item.href);
        return (
          <li key={item.href}>
            {/* The icon sits at the rail's centre whether open or folded, so only the width moves. */}
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              title={rail ? item.label : undefined}
              className={cx(
                "flex min-h-11 items-center gap-3 rounded-xl px-[18px] text-base transition-colors duration-200",
                active ? "bg-ink font-semibold text-paper" : "hover:bg-wash",
              )}
            >
              <Icon>{item.icon}</Icon>
              {/* The curtain: opening the rail draws each name back in turn, top to bottom. */}
              <span
                style={{ "--i": i } as CSSProperties}
                className="whitespace-nowrap transition-[clip-path,opacity] delay-[calc(var(--i)_*_45ms_+_150ms)] duration-500 ease-out-soft [clip-path:inset(0_0_0_0)] lg:rail:opacity-0 lg:rail:delay-0 lg:rail:duration-200 lg:rail:[clip-path:inset(0_100%_0_0)]"
              >
                {item.label}
              </span>
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
function ActiveNav(props: NavProps) {
  return <NavGroups activePath={usePathname()} {...props} />;
}

function SidebarContent({ userSlot, rail, onNavigate }: NavProps & { userSlot: ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center px-6 transition-[padding] duration-500 ease-out-soft lg:rail:justify-center lg:rail:px-0">
        <Link href="/" onClick={onNavigate} aria-label="JodyOS dashboard">
          {/* Folded: "Jody" on top, "OS" underneath. */}
          <Wordmark className="transition-[font-size] duration-500 ease-out-soft lg:rail:inline-block lg:rail:text-center lg:rail:text-[28px] lg:rail:leading-[0.9] lg:rail:[&>span]:block" />
        </Link>
      </div>

      {/* Desktop: the list sits mid-height, level with the arrow. pt-10 makes up for the user box being 24px taller than the header. */}
      <nav className="no-scrollbar flex-1 overflow-y-auto py-4 lg:flex lg:flex-col lg:pt-10" aria-label="Main">
        <Suspense fallback={<NavGroups activePath={null} rail={rail} onNavigate={onNavigate} />}>
          <ActiveNav rail={rail} onNavigate={onNavigate} />
        </Suspense>
      </nav>

      {/* Folded: just the avatar; signing out waits for the open sidebar. */}
      <div className="m-3 shrink-0 overflow-hidden rounded-2xl bg-wash lg:rail:[&_form]:hidden lg:rail:[&>div]:px-2.5">{userSlot}</div>
    </div>
  );
}

export function AppShell({ children, userSlot }: { children: ReactNode; userSlot: ReactNode }) {
  const [open, setOpen] = useState(false);
  const rail = useSyncExternalStore(onRailChange, railClosed, () => false);
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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-hair bg-paper transition-[width] duration-500 ease-out-soft lg:block lg:rail:w-20">
        <div className="h-full overflow-hidden">
          <SidebarContent userSlot={userSlot} rail={rail} />
        </div>
        <button
          type="button"
          onClick={toggleRail}
          aria-expanded={!rail}
          aria-label={rail ? "Open the sidebar" : "Close the sidebar"}
          title={rail ? "Open the sidebar" : "Close the sidebar"}
          className="absolute -right-4 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-hair bg-paper transition-colors duration-200 hover:bg-ink hover:text-paper"
        >
          <Icon className="size-4 transition-transform duration-500 ease-out-soft lg:rail:rotate-180">
            <path d="m15 6-6 6 6 6" />
          </Icon>
        </button>
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

      <div className="transition-[padding] duration-500 ease-out-soft lg:pl-64 lg:rail:pl-20">
        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 lg:px-12 lg:py-12">{children}</main>
      </div>
    </div>
  );
}
