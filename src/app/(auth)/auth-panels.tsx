"use client";

import { createContext, use, useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "@/components/ui/primitives";

/*
 * The sign-in card: password on one side, an email code on the other. A
 * black panel with the words covers one half; the form sits in the other.
 * Switching slides the black panel across and brings the other form in. On a
 * phone the panel sits on top and the forms simply swap.
 */

export type AuthMode = "login" | "code";

const ModeContext = createContext<(mode: AuthMode) => void>(() => {});

/** A button anywhere inside the card that switches to the other side. */
export function SwitchTo({ mode, children, className }: { mode: AuthMode; children: ReactNode; className?: string }) {
  const show = use(ModeContext);
  return (
    <button type="button" onClick={() => show(mode)} className={className}>
      {children}
    </button>
  );
}

const TITLES: Record<AuthMode, string> = { login: "Sign in · JodyOS", code: "Get a code · JodyOS" };

function Panel({
  mode,
  active,
  title,
  intro,
  children,
  panelRef,
}: {
  mode: AuthMode;
  active: boolean;
  title: string;
  intro: string;
  children: ReactNode;
  panelRef: (el: HTMLElement | null) => void;
}) {
  return (
    <section
      ref={panelRef}
      aria-labelledby={`${mode}-title`}
      inert={!active}
      className={cx(
        "flex items-center px-6 py-10 sm:px-12 md:row-start-1 md:py-6",
        mode === "code" ? "md:col-start-1" : "md:col-start-2",
        "transition-[opacity,transform] duration-500 ease-out",
        active
          ? "translate-x-0 opacity-100 md:delay-300"
          : cx("pointer-events-none opacity-0 max-md:hidden", mode === "code" ? "md:-translate-x-12" : "md:translate-x-12"),
      )}
    >
      <div className="mx-auto w-full max-w-sm">
        <h1 id={`${mode}-title`} className="text-4xl font-extrabold leading-none tracking-[-0.04em] sm:text-5xl">
          {title}
        </h1>
        <p className="mb-6 mt-2 text-muted">{intro}</p>
        {children}
      </div>
    </section>
  );
}

function Point({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span aria-hidden="true" className="mt-[0.45rem] size-2 shrink-0 rounded-full bg-paper" />
      <span>{children}</span>
    </li>
  );
}

/** The words on the black panel for each side, cross-fading as it slides. */
function Story({ mode, active, children }: { mode: AuthMode; active: boolean; children: ReactNode }) {
  return (
    <div
      inert={!active}
      data-mode={mode}
      className={cx(
        "[grid-area:1/1] transition-[opacity,transform] duration-500 ease-out",
        active ? "translate-y-0 opacity-100 delay-300" : "pointer-events-none translate-y-4 opacity-0",
      )}
    >
      {children}
    </div>
  );
}

const lightButton =
  "group inline-flex min-h-11 items-center gap-2 rounded-full bg-paper px-5 text-sm font-semibold text-ink transition-[transform,background-color] duration-200 hover:bg-mist active:scale-[0.97]";

export function AuthPanels({ login, code }: { login: ReactNode; code: ReactNode }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const panels = useRef(new Map<AuthMode, HTMLElement>());
  const switched = useRef(false);

  function show(next: AuthMode) {
    if (next === mode) return;
    switched.current = true;
    setMode(next);
    document.title = TITLES[next];
  }

  // After a switch, put the cursor in the first field of the form that came in.
  useEffect(() => {
    if (!switched.current) return;
    const panel = panels.current.get(mode);
    const timer = window.setTimeout(() => {
      panel?.querySelector<HTMLElement>("input:not([type=hidden]), button")?.focus({ preventScroll: true });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [mode]);

  const isLogin = mode === "login";

  return (
    <ModeContext value={show}>
      <div className="relative mx-auto flex w-full max-w-5xl animate-rise flex-col overflow-hidden rounded-[2rem] bg-paper shadow-[0_50px_100px_-30px_rgba(0,0,0,0.35),0_20px_40px_-20px_rgba(0,0,0,0.2)] md:block md:min-h-[540px]">
        <div className="order-2 md:grid md:min-h-[540px] md:grid-cols-2">
          <Panel
            mode="code"
            active={!isLogin}
            title="Get a code."
            intro="Only for emails a super admin has added."
            panelRef={(el) => (el ? panels.current.set("code", el) : panels.current.delete("code"))}
          >
            {code}
          </Panel>
          <Panel
            mode="login"
            active={isLogin}
            title="Sign in."
            intro="Good to see you again."
            panelRef={(el) => (el ? panels.current.set("login", el) : panels.current.delete("login"))}
          >
            {login}
          </Panel>
        </div>

        {/* The black panel: words on top on a phone, sliding over one half on wider screens. */}
        <div
          className={cx(
            "relative order-1 overflow-hidden bg-ink px-6 py-10 text-paper sm:px-12 md:absolute md:inset-y-0 md:left-0 md:z-10 md:flex md:w-1/2 md:items-center md:py-10",
            "md:transition-transform md:duration-[850ms] md:ease-[cubic-bezier(0.77,0,0.18,1)]",
            isLogin ? "md:translate-x-0" : "md:translate-x-full",
          )}
        >
          <Backdrop flipped={!isLogin} />
          <div className="relative grid w-full">
            <Story mode="login" active={isLogin}>
              <p className="label text-paper/70">JodyOS · private</p>
              <p className="mt-4 text-4xl font-extrabold leading-[0.95] tracking-[-0.04em] sm:text-6xl">Welcome back.</p>
              <p className="mt-5 max-w-sm text-lg leading-relaxed text-paper/80">Your businesses, websites, links and spending, in one calm place.</p>
              <ul className="mt-8 hidden space-y-3 text-[15px] text-paper/90 sm:block">
                <Point>Every business in its own tab</Point>
                <Point>Reminders before a domain or payment is due</Point>
                <Point>Jody Core, ready when you are</Point>
              </ul>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <span className="text-sm text-paper/70">No password to hand?</span>
                <SwitchTo mode="code" className={lightButton}>
                  Get code
                  <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">
                    →
                  </span>
                </SwitchTo>
              </div>
            </Story>
            <Story mode="code" active={!isLogin}>
              <p className="label text-paper/70">One-time code</p>
              <p className="mt-4 text-4xl font-extrabold leading-[0.95] tracking-[-0.04em] sm:text-6xl">Just your email.</p>
              <p className="mt-5 max-w-sm text-lg leading-relaxed text-paper/80">We email you a 6-digit code. Type it in and you&apos;re signed in.</p>
              <ul className="mt-8 hidden space-y-3 text-[15px] text-paper/90 sm:block">
                <Point>Only for people a super admin added</Point>
                <Point>Works once, for 10 minutes</Point>
                <Point>Nothing to remember</Point>
              </ul>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <span className="text-sm text-paper/70">Have your password?</span>
                <SwitchTo mode="login" className={lightButton}>
                  <span aria-hidden="true" className="transition-transform duration-200 group-hover:-translate-x-1">
                    ←
                  </span>
                  Sign in
                </SwitchTo>
              </div>
            </Story>
          </div>
        </div>
      </div>
    </ModeContext>
  );
}

/** Quiet decoration on the black panel: a dot grid and a large outlined J that drifts as the panel moves. */
function Backdrop({ flipped }: { flipped: boolean }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 opacity-[0.12] [background-image:radial-gradient(circle,#fff_1px,transparent_1.2px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
      <svg
        viewBox="0 0 64 64"
        className={cx(
          "absolute -bottom-10 -right-6 size-64 text-paper opacity-[0.09] transition-transform duration-[1200ms] ease-[cubic-bezier(0.77,0,0.18,1)]",
          flipped ? "-rotate-[10deg] scale-90" : "rotate-[6deg]",
        )}
      >
        <path
          d="M36 14h10v26c0 7.2-5.2 12-12.6 12C26.4 52 21 47.6 20 40.6l9.6-1.8c.4 2.8 2 4.4 4.2 4.4 2.6 0 2.2-1.6 2.2-4.2z"
          fill="none"
          stroke="currentColor"
          strokeWidth="0.8"
        />
      </svg>
    </div>
  );
}
