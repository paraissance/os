import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/current-user";
import { listIntegrations, type IntegrationStatus } from "@/lib/integrations";
import { Badge, PageHeader, Panel, Skeleton, StatusDot, type Tone } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Integrations" };

const STATUS: Record<IntegrationStatus, { label: string; tone: Tone }> = {
  connected: { label: "Connected", tone: "ok" },
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
      <Suspense
        fallback={
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-44" />
            ))}
          </div>
        }
      >
        <IntegrationGrid />
      </Suspense>
    </>
  );
}

async function IntegrationGrid() {
  await requireUser();
  const integrations = listIntegrations();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {integrations.map((i) => {
        const s = STATUS[i.status];
        return (
          <Panel key={i.id} className="flex flex-col p-5 animate-fade-up">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-subtle">{i.category}</p>
                <h2 className="mt-1 text-[15px] font-semibold text-fg">{i.name}</h2>
              </div>
              <Badge tone={s.tone}>
                <StatusDot tone={s.tone} pulse={i.status === "connected"} />
                {s.label}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-muted">{i.description}</p>
            <div className="mt-4 flex-1 rounded-xl border border-line bg-ink-900/60 p-3.5 text-sm">
              <p className="text-muted">{i.setup}</p>
              {i.envVars.length ? (
                <p className="mt-2 flex flex-wrap gap-1.5">
                  {i.envVars.map((v) => (
                    <code key={v} className="rounded-md border border-line px-1.5 py-0.5 font-mono text-xs text-fg">
                      {v}
                    </code>
                  ))}
                </p>
              ) : null}
            </div>
            <p className="mt-3 text-xs text-subtle">{i.phase === 1 ? "Available now" : `Phase ${i.phase}`}</p>
          </Panel>
        );
      })}
    </div>
  );
}
