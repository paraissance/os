import type { Metadata } from "next";
import { Suspense } from "react";
import { listAdmins } from "@/lib/auth/admins";
import { requireSession } from "@/lib/auth/current-user";
import { getSettings } from "@/lib/settings";
import { AI_EFFORTS, AI_MODELS } from "@/lib/ai/models";
import { Part } from "@/components/dashboard/ui";
import { Badge, PageHeader, Panel, Skeleton } from "@/components/ui/primitives";
import { AddAdminForm, PasswordForm, RemoveAdminButton, SettingsForm } from "./forms";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" />
      <Suspense fallback={<Skeleton className="h-[36rem] rounded-3xl" />}>
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
    <div className="space-y-10">
      <Part title="Profile and AI">
        <Panel>
          <SettingsForm
            initial={{ name: user.name, ...settings }}
            email={user.email}
            timeZones={timeZones()}
            models={AI_MODELS.map((m) => ({ id: m.id, label: m.label }))}
            efforts={[...AI_EFFORTS]}
          />
        </Panel>
      </Part>

      <Part title="Password">
        <Panel>
          <PasswordForm />
        </Panel>
      </Part>

      <Part title="Super admins" count={admins.length}>
        <Panel>
          <ul>
            {admins.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 border-b border-paper px-6 py-4">
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
          <details className="p-6">
            <summary className="cursor-pointer font-semibold">Add a super admin</summary>
            <div className="mt-4">
              <AddAdminForm />
            </div>
          </details>
        </Panel>
      </Part>
    </div>
  );
}
