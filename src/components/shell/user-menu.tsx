import Link from "next/link";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Skeleton } from "@/components/ui/primitives";

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <Link href="/login" className="block rounded-xl px-3 py-2 text-sm text-muted hover:bg-white/[0.05] hover:text-fg">
        Sign in
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent/30 to-violet/30 text-xs font-semibold text-fg ring-1 ring-line-strong">
        {initials(user.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-fg">{user.name}</span>
        <span className="block truncate text-xs text-subtle">{user.email}</span>
      </span>
      <form action={logoutAction}>
        <button
          type="submit"
          className="inline-flex size-10 items-center justify-center rounded-xl text-subtle hover:bg-white/[0.06] hover:text-fg"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="size-4" />
        </button>
      </form>
    </div>
  );
}

export function UserMenuSkeleton() {
  return (
    <div className="flex items-center gap-3 px-2 py-1.5">
      <Skeleton className="size-9 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  );
}
