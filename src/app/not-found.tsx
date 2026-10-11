import Link from "next/link";
import { buttonClass } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center px-5">
      <div className="mx-auto w-full max-w-xl">
        <p className="animate-rise text-[9rem] font-extrabold leading-none tracking-[-0.06em]">404</p>
        <p className="mt-4 animate-rise text-lg [animation-delay:80ms]">That page doesn&apos;t exist in JodyOS.</p>
        <Link href="/" className={buttonClass("primary", "mt-8")}>
          Back to the dashboard →
        </Link>
      </div>
    </div>
  );
}
