import type { Metadata } from "next";
import { Suspense } from "react";
import { listAdmins } from "@/lib/auth/admins";
import { requireSession } from "@/lib/auth/current-user";
import { getSettings } from "@/lib/settings";
import { AI_EFFORTS, AI_MODELS } from "@/lib/ai/models";
import { Badge, PageHeader, Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
import { AddAdminForm, PasswordForm, RemoveAdminButton, SettingsForm } from "./forms";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader eyebrow="System" title="Settings" description="Your profile, how Jody Core works, your password and who has access." />
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
  const { user } = await requireSession();
  const [settings, admins] = await Promise.all([getSettings(), listAdmins()]);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <Panel>
        <PanelHeader title="Profile and AI" description="How Jody Core addresses you and how it thinks." />
        <SettingsForm
          initial={{ name: user.name, ...settings }}
          email={user.email}
          timeZones={timeZones()}
          models={AI_MODELS.map((m) => ({ id: m.id, label: `${m.label}: ${m.note}` }))}
          efforts={[...AI_EFFORTS]}
        />
      </Panel>

      <div className="space-y-10">
        <Panel>
          <PanelHeader title="Password" description="Changing it signs out every other device." />
          <PasswordForm />
        </Panel>

        <Panel>
          <PanelHeader title="Super admin access" description="Everyone here can sign in and use all of JodyOS." />
          <ul>
            {admins.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 border-b border-hair px-5 py-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {a.name}
                    {a.role === "owner" ? <Badge tone="accent">Default</Badge> : null}
                    {a.id === user.id ? <Badge>You</Badge> : null}
                  </p>
                  <p className="truncate text-sm text-muted">{a.email}</p>
                </div>
                {a.role !== "owner" && a.id !== user.id ? <RemoveAdminButton id={a.id} name={a.name} /> : null}
              </li>
            ))}
          </ul>
          <div className="p-5">
            <h3 className="mb-4 font-bold">Add a super admin</h3>
            <AddAdminForm />
          </div>
        </Panel>
      </div>
    </div>
  );
}
