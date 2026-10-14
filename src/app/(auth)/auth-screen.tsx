import { count } from "drizzle-orm";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { emailReady } from "@/lib/email";
import { envStatus } from "@/lib/env";
import { Alert, Skeleton, buttonClass } from "@/components/ui/primitives";
import { AuthPanels } from "./auth-panels";
import { CodeForm } from "./login/code-form";
import { LoginForm } from "./login/login-form";
import { SetupForm } from "./setup/setup-form";

/** /login: user name and password on one side, an email code on the other. */
export function AuthScreen() {
  return (
    <AuthPanels
      login={
        <Suspense fallback={<Skeleton className="h-64" />}>
          <LoginForm />
        </Suspense>
      }
      code={
        <Suspense fallback={<Skeleton className="h-48" />}>
          <CodeSide />
        </Suspense>
      }
    />
  );
}

async function CodeSide() {
  await connection();
  return <CodeForm ready={emailReady()} />;
}

/** /setup: a plain card, only used once on a fresh install. */
export function SetupScreen() {
  return (
    <SetupCard>
      <Suspense fallback={<Skeleton className="h-96" />}>
        <SetupGate />
      </Suspense>
    </SetupCard>
  );
}

function SetupCard({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md animate-rise rounded-[2rem] bg-paper p-6 shadow-[0_50px_100px_-30px_rgba(0,0,0,0.35),0_20px_40px_-20px_rgba(0,0,0,0.2)] sm:p-10">
      <h1 className="text-4xl font-extrabold leading-none tracking-[-0.04em] sm:text-5xl">Set up.</h1>
      <p className="mb-6 mt-2 text-muted">Create the owner account. This only works once.</p>
      {children}
    </div>
  );
}

/** Setup works once: only while no owner exists and a SETUP_TOKEN is configured. */
async function SetupGate() {
  await connection();
  const db = await getDb();
  const [{ value: existing }] = await db.select({ value: count() }).from(users);

  if (existing > 0) {
    return (
      <div className="space-y-5">
        <Alert tone="ok">JodyOS is already set up.</Alert>
        <Link href="/login" className={buttonClass("primary", "w-full")}>
          Sign in instead →
        </Link>
      </div>
    );
  }

  if (!envStatus().setupToken) {
    return (
      <Alert tone="warn">
        <p className="font-semibold">Setup is locked.</p>
        <p className="mt-1">
          Add a <code className="font-mono">SETUP_TOKEN</code> environment variable (24+ random characters), restart or redeploy, then reload this page.
          You&apos;ll be asked for the token to prove you own this deployment.
        </p>
      </Alert>
    );
  }

  return <SetupForm />;
}
