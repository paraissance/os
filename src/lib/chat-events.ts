/** Newline-delimited JSON events streamed by POST /api/chat. Shared by server and client. */
export type ChatEvent =
  | { type: "meta"; conversationId: string }
  | { type: "text"; text: string }
  | { type: "done"; stopReason: string | null; model: string }
  | { type: "error"; message: string };

/** Splits a growing NDJSON buffer into complete events plus the unfinished remainder. */
export function parseChatEvents(buffer: string): { events: ChatEvent[]; rest: string } {
  const lines = buffer.split("\n");
  const rest = lines.pop() ?? "";
  const events: ChatEvent[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line) as ChatEvent);
    } catch {
      // Ignore a malformed line rather than killing the stream.
    }
  }
  return { events, rest };
}
