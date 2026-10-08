import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/current-user";
import { getMessages, listConversations } from "@/lib/chat";
import { envStatus } from "@/lib/env";
import { getSettings } from "@/lib/settings";
import { Skeleton } from "@/components/ui/primitives";
import { ChatClient } from "./chat-client";

export const metadata: Metadata = { title: "AI Command" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function CommandPage(props: PageProps<"/command">) {
  return (
    <Suspense fallback={<Skeleton className="h-[70vh]" />}>
      <CommandView searchParams={props.searchParams} />
    </Suspense>
  );
}

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

async function CommandView({ searchParams }: { searchParams: PageProps<"/command">["searchParams"] }) {
  const user = await requireUser();
  const sp = await searchParams;
  const requested = first(sp.c);
  const conversationId = requested && UUID.test(requested) ? requested : null;
  const draft = (first(sp.q) ?? "").slice(0, 2000);

  const [conversations, messages, settings] = await Promise.all([
    listConversations(user.id),
    conversationId ? getMessages(user.id, conversationId) : Promise.resolve([]),
    getSettings(),
  ]);
  if (conversationId && messages === null) redirect("/command");

  return (
    <ChatClient
      key={conversationId ?? "new"}
      initialConversationId={conversationId}
      initialMessages={(messages ?? []).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        model: m.model,
        stopReason: m.stopReason,
      }))}
      initialConversations={conversations.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt.toISOString() }))}
      initialDraft={draft}
      aiOnline={envStatus().anthropic}
      model={settings.aiModel}
      userName={user.name.split(" ")[0]}
    />
  );
}
