import { Wordmark } from "@/components/ui/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-16 items-center border-b border-ink px-5 sm:px-8">
        <Wordmark />
      </header>
      <main className="flex flex-1 items-start justify-center px-5 py-12 sm:items-center sm:py-16">
        <div className="w-full max-w-md">{children}</div>
      </main>
      <footer className="flex h-12 items-center border-t border-ink px-5 text-xs text-muted sm:px-8">
        Private system. Authorised access only.
      </footer>
    </div>
  );
}
