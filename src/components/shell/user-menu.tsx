import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Skeleton } from "@/components/ui/primitives";

export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <Link href="/login" className="block px-4 py-4 text-sm font-semibold underline underline-offset-4">
        Sign in
      </Link>
    );
  }
  return (
    // Bottom of the sidebar. Folded to its rail: the user icon over a sign-out icon.
    <div className="flex items-center justify-between gap-3 py-1.5 pl-1.5 pr-2 lg:rail:flex-col lg:rail:gap-1.5 lg:rail:p-1.5">
      <span className="flex min-w-0 items-center gap-3" title={`${user.name} · ${user.email}`}>
        <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-paper">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="size-5">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
          </svg>
        </span>
        <span className="min-w-0 lg:rail:hidden">
          <span className="block truncate text-sm font-semibold">{user.name}</span>
          <span className="block truncate text-xs text-muted">{user.email}</span>
        </span>
      </span>
      <form action={logoutAction}>
        <button
          type="submit"
          title="Sign out"
          className="shine flex shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-paper px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-mist lg:rail:size-9 lg:rail:p-0"
        >
          <span className="lg:rail:sr-only">Sign out</span>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="hidden size-4 lg:rail:block">
            <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4" />
          </svg>
        </button>
      </form>
    </div>
  );
}

export function UserMenuSkeleton() {
  return (
    <div className="flex items-center gap-3 py-1.5 pl-1.5 pr-4 lg:rail:p-1.5">
      <Skeleton className="size-9 rounded-full" />
      <div className="space-y-1.5 lg:rail:hidden">
        <Skeleton className="h-4 w-24 rounded-md" />
        <Skeleton className="h-3 w-36 rounded-md" />
      </div>
    </div>
  );
}
