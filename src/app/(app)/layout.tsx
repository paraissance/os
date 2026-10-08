import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { UserMenu, UserMenuSkeleton } from "@/components/shell/user-menu";

/**
 * The authenticated shell. The sidebar is static and prerendered; only the
 * user menu reads the session, so it streams in behind its own boundary.
 * Each page checks the session itself (requireUser) before reading data.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell
      userSlot={
        <Suspense fallback={<UserMenuSkeleton />}>
          <UserMenu />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}
