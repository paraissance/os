import Link from "next/link";
import { buttonClass } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center px-5">
      <div className="mx-auto w-full max-w-xl">
        <p className="text-[9rem] font-extrabold leading-none tracking-[-0.06em]">404</p>
        <p className="mt-4 border-t-2 border-ink pt-4 text-lg">That page doesn&apos;t exist in JodyOS.</p>
        <Link href="/" className={buttonClass("primary", "mt-8")}>
          Back to the dashboard →
        </Link>
      </div>
    </div>
  );
}
