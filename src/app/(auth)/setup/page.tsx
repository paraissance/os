import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { count } from "drizzle-orm";
import { Alert, Panel, Skeleton, buttonClass } from "@/components/ui/primitives";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { envStatus } from "@/lib/env";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = { title: "Setup" };

export default function SetupPage() {
  return (
    <Panel className="p-6 sm:p-8">
      <h1 className="text-xl font-semibold tracking-tight">Set up JodyOS</h1>
      <p className="mt-1 text-sm text-muted">Create the owner account. This only works once.</p>
      <div className="mt-6">
        <Suspense fallback={<Skeleton className="h-80" />}>
          <SetupGate />
        </Suspense>
      </div>
    </Panel>
  );
}

async function SetupGate() {
  await connection();
  const db = await getDb();
  const [{ value: existing }] = await db.select({ value: count() }).from(users);

  if (existing > 0) {
    return (
      <div className="space-y-4">
        <Alert tone="ok">JodyOS is already set up.</Alert>
        <Link href="/login" className={buttonClass("primary", "w-full")}>
          Go to sign in
        </Link>
      </div>
    );
  }

  if (!envStatus().setupToken) {
    return (
      <Alert tone="warn">
        <p className="font-medium">Setup is locked.</p>
        <p className="mt-1">
          Add a <code className="font-mono">SETUP_TOKEN</code> environment variable (24+ random characters), restart or
          redeploy, then reload this page. You&apos;ll be asked for the token to prove you own this deployment.
        </p>
      </Alert>
    );
  }

  return <SetupForm />;
}
