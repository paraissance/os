import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Skeleton } from "@/components/ui/primitives";

export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <Link href="/login" className="block px-5 py-4 text-sm font-semibold underline underline-offset-4">
        Sign in
      </Link>
    );
  }
  return (
    <div className="flex items-end justify-between gap-3 px-5 py-4">
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{user.name}</span>
        <span className="block truncate text-xs text-muted">{user.email}</span>
      </span>
      <form action={logoutAction}>
        <button type="submit" className="shrink-0 text-xs font-semibold underline decoration-1 underline-offset-4 hover:decoration-2">
          Sign out
        </button>
      </form>
    </div>
  );
}

export function UserMenuSkeleton() {
  return (
    <div className="space-y-1.5 px-5 py-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-3 w-36" />
    </div>
  );
}
