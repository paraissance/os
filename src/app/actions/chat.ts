"use server";

import { z } from "zod";
import { logActivity } from "@/lib/activity";
import { requireUser } from "@/lib/auth/current-user";
import { deleteConversation } from "@/lib/chat";

export async function deleteConversationAction(conversationId: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const id = z.uuid().safeParse(conversationId);
  if (!id.success) return { ok: false };
  const ok = await deleteConversation(user.id, id.data);
  if (ok) {
    await logActivity({
      action: "ai.conversation_deleted",
      status: "success",
      userId: user.id,
      result: "Conversation deleted",
      metadata: { conversationId: id.data },
    });
  }
  return { ok };
}
