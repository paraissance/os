import { Wordmark } from "@/components/ui/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mb-8 animate-fade-up">
        <Wordmark gradientId="auth" />
      </div>
      <div className="w-full max-w-md animate-fade-up">{children}</div>
      <p className="mt-8 text-center font-mono text-xs text-subtle">Private system · authorised access only</p>
    </div>
  );
}
