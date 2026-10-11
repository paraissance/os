import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/primitives";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-5xl font-extrabold leading-[0.95] tracking-[-0.045em]">Sign in.</h1>
      <p className="mt-3 text-muted">Your operating system is waiting.</p>
      <div className="mt-8 rounded-3xl bg-wash p-6 sm:p-8">
        <Suspense fallback={<Skeleton className="h-56" />}>
          <LoginForm />
        </Suspense>
      </div>
    </>
  );
}
