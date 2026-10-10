import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/current-user";
import { listIntegrations, type IntegrationStatus } from "@/lib/integrations";
import { Badge, PageHeader, Skeleton, StatusDot, type Tone } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Integrations" };

const STATUS: Record<IntegrationStatus, { label: string; tone: Tone }> = {
  connected: { label: "Connected", tone: "accent" },
  not_configured: { label: "Not configured", tone: "warn" },
  planned: { label: "Planned", tone: "neutral" },
};

export default function IntegrationsPage() {
  return (
    <>
      <PageHeader
        eyebrow="System"
        title="Integrations"
        description="Status comes from real configuration only. Each service is connected in its own phase, one at a time, with its required keys listed here."
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <IntegrationTable />
      </Suspense>
    </>
  );
}

async function IntegrationTable() {
  await requireUser();
  const integrations = listIntegrations();
  return (
    <div className="border-t-2 border-ink">
      <div className="label hidden grid-cols-[12rem_9rem_1fr_5rem] gap-6 border-b border-ink py-2.5 md:grid">
        <span>Service</span>
        <span>Status</span>
        <span>Setup</span>
        <span className="text-right">Phase</span>
      </div>
      <ul>
        {integrations.map((i) => {
          const s = STATUS[i.status];
          return (
            <li key={i.id} className="grid gap-x-6 gap-y-2 border-b border-hair py-5 md:grid-cols-[12rem_9rem_1fr_5rem]">
              <div>
                <p className="text-lg font-bold leading-tight tracking-[-0.02em]">{i.name}</p>
                <p className="mt-0.5 text-sm text-muted">{i.category}</p>
              </div>
              <div className="flex items-start gap-2 pt-1">
                <span className="pt-[3px]">
                  <StatusDot tone={i.status === "connected" ? "ok" : "warn"} />
                </span>
                <Badge tone={s.tone}>{s.label}</Badge>
              </div>
              <div className="text-sm leading-relaxed">
                <p>{i.description}</p>
                <p className="mt-1 text-muted">{i.setup}</p>
                {i.envVars.length ? (
                  <p className="mt-2 flex flex-wrap gap-1.5">
                    {i.envVars.map((v) => (
                      <code key={v} className="bg-wash px-1.5 py-0.5 font-mono text-xs">
                        {v}
                      </code>
                    ))}
                  </p>
                ) : null}
              </div>
              <p className="font-mono text-sm md:pt-1 md:text-right">{i.phase === 1 ? "Now" : `P${i.phase}`}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
