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
    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <span className="flex min-w-0 items-center gap-3">
        <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-paper">
          {user.name.trim().charAt(0).toUpperCase() || "J"}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{user.name}</span>
          <span className="block truncate text-xs text-muted">{user.email}</span>
        </span>
      </span>
      <form action={logoutAction}>
        <button type="submit" className="shrink-0 whitespace-nowrap rounded-full bg-paper px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-mist">
          Sign out
        </button>
      </form>
    </div>
  );
}

export function UserMenuSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <Skeleton className="size-9 rounded-full" />
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-24 rounded-md" />
        <Skeleton className="h-3 w-36 rounded-md" />
      </div>
    </div>
  );
}
