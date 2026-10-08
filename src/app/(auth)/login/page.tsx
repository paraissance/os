import type { Metadata } from "next";
import { Suspense } from "react";
import { Panel, Skeleton } from "@/components/ui/primitives";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <Panel className="p-6 sm:p-8">
      <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-1 text-sm text-muted">Welcome back. Your operating system is waiting.</p>
      <div className="mt-6">
        <Suspense fallback={<Skeleton className="h-56" />}>
          <LoginForm />
        </Suspense>
      </div>
    </Panel>
  );
}
