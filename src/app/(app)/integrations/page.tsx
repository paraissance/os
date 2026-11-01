import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/current-user";
import { listIntegrations, type Integration, type IntegrationStatus } from "@/lib/integrations";
import { HeroStats, Part, Rows } from "@/components/dashboard/ui";
import { CountUp } from "@/components/motion/count-up";
import { Badge, PageHeader, Skeleton } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Integrations" };

export default function IntegrationsPage() {
  return (
    <>
      <PageHeader eyebrow="System" title="Integrations" description="What JodyOS is connected to, and what each connection needs. Status comes from real settings only." />
      <Suspense fallback={<Skeleton className="h-96 rounded-3xl" />}>
        <IntegrationGroups />
      </Suspense>
    </>
  );
}

const GROUPS: { status: IntegrationStatus; title: string; intro: string }[] = [
  { status: "connected", title: "Connected", intro: "Set up and working." },
  { status: "not_configured", title: "Needs setup", intro: "Built and ready: each one says what it needs." },
  { status: "planned", title: "Planned", intro: "Arrives in a later phase, one at a time." },
];

function Item({ integration: i }: { integration: Integration }) {
  return (
    <li>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-bold">
          {i.name} <span className="ml-1 text-sm font-normal text-muted">{i.category}</span>
        </p>
        {i.status === "planned" ? <Badge>Phase {i.phase}</Badge> : null}
      </div>
      <p className="mt-1 text-sm leading-relaxed text-muted">{i.description}</p>
      {/* Once connected there's nothing left to do, so its setup steps stay out of the way. */}
      {i.status === "not_configured" ? (
        <>
          <p className="mt-2 text-sm leading-relaxed">{i.setup}</p>
          {i.envVars.length ? (
            <p className="mt-2 flex flex-wrap gap-1.5">
              {i.envVars.map((v) => (
                <code key={v} className="rounded-md bg-paper px-1.5 py-0.5 font-mono text-xs">
                  {v}
                </code>
              ))}
            </p>
          ) : null}
        </>
      ) : null}
    </li>
  );
}

async function IntegrationGroups() {
  await requireUser();
  const integrations = listIntegrations();
  const count = (status: IntegrationStatus) => integrations.filter((i) => i.status === status).length;
  return (
    <div className="space-y-10">
      <HeroStats
        stats={[
          { label: "Connected", value: <CountUp value={count("connected")} /> },
          { label: "Needs setup", value: <CountUp value={count("not_configured")} /> },
          { label: "Planned", value: <CountUp value={count("planned")} /> },
        ]}
      />
      {GROUPS.map((g) => {
        const items = integrations.filter((i) => i.status === g.status);
        return items.length ? (
          <Part key={g.status} title={g.title} intro={g.intro} count={items.length}>
            <Rows>
              {items.map((i) => (
                <Item key={i.id} integration={i} />
              ))}
            </Rows>
          </Part>
        ) : null;
      })}
    </div>
  );
}
