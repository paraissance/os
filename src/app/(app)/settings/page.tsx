import type { Metadata } from "next";
import { Suspense } from "react";
import { requireSession } from "@/lib/auth/current-user";
import { requestNow } from "@/lib/clock";
import { listActiveSessions } from "@/lib/auth/sessions";
import { envStatus } from "@/lib/env";
import { describeUserAgent, formatDateTime, formatRelative } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { AI_EFFORTS, AI_MODELS } from "@/lib/ai/models";
import { Badge, PageHeader, Panel, PanelHeader, Skeleton, StatusDot } from "@/components/ui/primitives";
import { PasswordForm, RevokeSessionsForm, SettingsForm } from "./forms";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader eyebrow="System" title="Settings" description="Profile, AI behaviour, security and environment." />
      <Suspense fallback={<Skeleton className="h-[36rem]" />}>
        <SettingsView />
      </Suspense>
    </>
  );
}

function timeZones() {
  const zones = Intl.supportedValuesOf("timeZone");
  return zones.includes("UTC") ? zones : ["UTC", ...zones];
}

async function SettingsView() {
  const { user, sessionId } = await requireSession();
  const [settings, sessions] = await Promise.all([getSettings(), listActiveSessions(user.id)]);
  const env = envStatus();
  const now = requestNow();

  const envRows: { label: string; value: string; ok: boolean; note?: string }[] = [
    {
      label: "Database",
      value: env.database === "postgres" ? "PostgreSQL (DATABASE_URL)" : "Local PGlite",
      ok: true,
      note: env.database === "pglite" ? "Development only. Production uses DATABASE_URL." : undefined,
    },
    {
      label: "ANTHROPIC_API_KEY",
      value: env.anthropic ? "Set" : "Not set",
      ok: env.anthropic,
      note: env.anthropic ? undefined : "AI Command stays offline until this is set.",
    },
    {
      label: "SETUP_TOKEN",
      value: env.setupToken ? "Set" : "Not set",
      ok: !env.setupToken,
      note: env.setupToken ? "Setup is done. Remove this variable." : undefined,
    },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <Panel className="animate-fade-up">
        <PanelHeader title="Profile and AI" description="How Jody Core addresses you and how it thinks." />
        <SettingsForm
          initial={{ name: user.name, ...settings }}
          email={user.email}
          timeZones={timeZones()}
          models={AI_MODELS.map((m) => ({ id: m.id, label: `${m.label}: ${m.note}` }))}
          efforts={[...AI_EFFORTS]}
        />
      </Panel>

      <div className="space-y-6">
        <Panel className="animate-fade-up">
          <PanelHeader title="Password" description="Changing it signs out every other device." />
          <PasswordForm />
        </Panel>

        <Panel className="animate-fade-up">
          <PanelHeader title="Active sessions" description={`${sessions.length} signed-in device${sessions.length === 1 ? "" : "s"}`} />
          <ul className="divide-y divide-line">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm text-fg">
                    {describeUserAgent(s.userAgent)}
                    {s.id === sessionId ? <Badge tone="accent">This device</Badge> : null}
                  </p>
                  <p className="text-xs text-subtle">
                    {s.ip ?? "unknown IP"} · signed in {formatDateTime(s.createdAt, settings.timezone)}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-subtle">{formatRelative(s.lastSeenAt, now)}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-line px-5 py-3">
            <RevokeSessionsForm disabled={sessions.length <= 1} />
          </div>
        </Panel>

        <Panel className="animate-fade-up">
          <PanelHeader title="Environment" description="Configuration checks. Values are never shown." />
          <ul className="divide-y divide-line">
            {envRows.map((r) => (
              <li key={r.label} className="px-5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <code className="font-mono text-[13px] text-fg">{r.label}</code>
                  <span className="flex items-center gap-2 text-sm text-muted">
                    <StatusDot tone={r.ok ? "ok" : "warn"} />
                    {r.value}
                  </span>
                </div>
                {r.note ? <p className="mt-1 text-xs text-subtle">{r.note}</p> : null}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
