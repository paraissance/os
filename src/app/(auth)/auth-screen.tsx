import { count } from "drizzle-orm";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { envStatus } from "@/lib/env";
import { Alert, Skeleton, buttonClass } from "@/components/ui/primitives";
import { AuthPanels, SwitchTo, type AuthMode } from "./auth-panels";
import { LoginForm } from "./login/login-form";
import { SetupForm } from "./setup/setup-form";

/** /login and /setup: the same card, opened on one side or the other. */
export function AuthScreen({ initial }: { initial: AuthMode }) {
  return (
    <AuthPanels
      initial={initial}
      login={
        <Suspense fallback={<Skeleton className="h-64" />}>
          <LoginForm />
        </Suspense>
      }
      setup={
        <Suspense fallback={<Skeleton className="h-96" />}>
          <SetupGate />
        </Suspense>
      }
    />
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
        <Alert tone="ok">JodyOS is already set up. There is one owner account.</Alert>
        <SwitchTo mode="login" className={buttonClass("primary", "w-full")}>
          Sign in instead →
        </SwitchTo>
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
