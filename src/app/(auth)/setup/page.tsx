import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { count } from "drizzle-orm";
import { Alert, Skeleton, buttonClass } from "@/components/ui/primitives";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { envStatus } from "@/lib/env";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = { title: "Setup" };

export default function SetupPage() {
  return (
    <>
      <h1 className="text-5xl font-extrabold leading-[0.95] tracking-[-0.045em]">Set up.</h1>
      <p className="mt-3 text-muted">Create the owner account. This only works once.</p>
      <div className="mt-8 border-t-2 border-ink pt-8">
        <Suspense fallback={<Skeleton className="h-80" />}>
          <SetupGate />
        </Suspense>
      </div>
    </>
  );
}

async function SetupGate() {
  await connection();
  const db = await getDb();
  const [{ value: existing }] = await db.select({ value: count() }).from(users);

  if (existing > 0) {
    return (
      <div className="space-y-5">
        <Alert tone="ok">JodyOS is already set up.</Alert>
        <Link href="/login" className={buttonClass("primary", "w-full")}>
          Go to sign in →
        </Link>
      </div>
    );
  }

  if (!envStatus().setupToken) {
    return (
      <Alert tone="warn">
        <p className="font-semibold">Setup is locked.</p>
        <p className="mt-1">
          Add a <code className="font-mono">SETUP_TOKEN</code> environment variable (24+ random characters), restart or
          redeploy, then reload this page. You&apos;ll be asked for the token to prove you own this deployment.
        </p>
      </Alert>
    );
  }

  return <SetupForm />;
}
