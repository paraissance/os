import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { conversations, messages } from "@/lib/db/schema";

/**
 * Conversation storage. Every function takes the owner's userId and filters
 * on it, so one user can never read or write another user's conversation by
 * guessing an id.
 */
export async function listConversations(userId: string, limit = 50) {
  const db = await getDb();
  return db
    .select({ id: conversations.id, title: conversations.title, updatedAt: conversations.updatedAt })
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt))
    .limit(limit);
}

export async function getConversation(userId: string, conversationId: string) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function getMessages(userId: string, conversationId: string) {
  const conversation = await getConversation(userId, conversationId);
  if (!conversation) return null;
  const db = await getDb();
  return db
    .select({
      id: messages.id,
      role: messages.role,
      content: messages.content,
      model: messages.model,
      stopReason: messages.stopReason,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt));
}

export function titleFrom(text: string) {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > 60 ? `${oneLine.slice(0, 57)}…` : oneLine || "New conversation";
}

export async function createConversation(userId: string, firstMessage: string) {
  const db = await getDb();
  const [row] = await db
    .insert(conversations)
    .values({ userId, title: titleFrom(firstMessage) })
    .returning({ id: conversations.id });
  return row.id;
}

export async function addMessage(
  conversationId: string,
  message: {
    role: "user" | "assistant";
    content: string;
    model?: string | null;
    stopReason?: string | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
  },
) {
  const db = await getDb();
  const [row] = await db
    .insert(messages)
    .values({ conversationId, ...message })
    .returning({ id: messages.id });
  await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, conversationId));
  return row.id;
}

export async function deleteConversation(userId: string, conversationId: string) {
  const db = await getDb();
  const removed = await db
    .delete(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .returning({ id: conversations.id });
  return removed.length > 0;
}
