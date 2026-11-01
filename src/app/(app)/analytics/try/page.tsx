import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getAgentBySlug } from "@/lib/agents";
import { requireUser } from "@/lib/auth/current-user";
import { envStatus } from "@/lib/env";
import { TryAgent } from "@/components/agents/embed-tools";
import { Alert, PageHeader, Skeleton, buttonClass } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Try an agent" };

/** The real website widget, opened on this page: what a visitor would see. /analytics/try?agent=<slug> */
export default function TryAgentPage(props: PageProps<"/analytics/try">) {
  return (
    <Suspense fallback={<Skeleton className="h-40" />}>
      <TryView searchParams={props.searchParams} />
    </Suspense>
  );
}

async function TryView({ searchParams }: { searchParams: PageProps<"/analytics/try">["searchParams"] }) {
  await requireUser();
  const { agent: slug } = await searchParams;
  const agent = typeof slug === "string" ? await getAgentBySlug(slug) : null;
  if (!agent) {
    return (
      <>
        <PageHeader title="Try an agent" />
        <Alert>There&apos;s no agent with that name. Pick one on AI &amp; Analytics.</Alert>
      </>
    );
  }
  return (
    <>
      <PageHeader
        title={`Try ${agent.name}`}
        description="The same chat visitors see, bottom right."
        action={
          <Link href={`/analytics?agent=${agent.business.slug}#agents`} className={buttonClass("secondary")}>
            ← Back to the agent
          </Link>
        }
      />
      {envStatus().anthropic ? null : (
        <Alert>The AI isn&apos;t on yet (ANTHROPIC_API_KEY), so it only gives its saved answers.</Alert>
      )}
      <TryAgent key={agent.business.slug} slug={agent.business.slug} />
    </>
  );
}
