import { Wordmark } from "@/components/ui/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-wash">
      {/* A faint dot grid behind the card. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(circle,#d4d4d4_1px,transparent_1.2px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
      />
      <header className="relative flex h-14 items-center px-5 sm:px-8">
        <Wordmark />
      </header>
      <main className="relative flex flex-1 items-start justify-center px-4 pb-10 pt-2 sm:items-center sm:px-8">
        <div className="w-full max-w-5xl">{children}</div>
      </main>
      <footer className="absolute inset-x-0 bottom-0 flex h-12 items-center justify-center px-5 text-xs text-muted sm:px-8">
        Private system. Authorised access only.
      </footer>
    </div>
  );
}
