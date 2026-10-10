"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { deleteConversationAction } from "@/app/actions/chat";
import { modelInfo } from "@/lib/ai/models";
import { parseChatEvents } from "@/lib/chat-events";
import { Markdown } from "@/components/markdown";
import { Alert, cx } from "@/components/ui/primitives";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string | null;
  stopReason?: string | null;
  streaming?: boolean;
  error?: string;
};

type Conv = { id: string; title: string; updatedAt: string };

const SUGGESTIONS = [
  "What can you do for me right now?",
  "Plan my week across all my brands",
  "Draft three social post ideas for Done For You Leads",
  "Outline what the GitHub and Vercel integrations should check",
];

let tempId = 0;
const nextTempId = () => `tmp-${++tempId}`;

function Cursor() {
  return <span className="ml-0.5 inline-block h-[1.05em] w-2 translate-y-[0.15em] bg-ink animate-blink" aria-hidden="true" />;
}

export function ChatClient({
  initialConversationId,
  initialMessages,
  initialConversations,
  initialDraft,
  aiOnline,
  model,
  userName,
}: {
  initialConversationId: string | null;
  initialMessages: Msg[];
  initialConversations: Conv[];
  initialDraft: string;
  aiOnline: boolean;
  model: string;
  userName: string;
}) {
  const router = useRouter();
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [conversations, setConversations] = useState<Conv[]>(initialConversations);
  const [input, setInput] = useState(initialDraft);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (initialDraft) inputRef.current?.focus();
  }, [initialDraft]);

  // Grow the composer with its content, up to a cap.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
    // Only show a scrollbar once the text is taller than the cap.
    el.style.overflowY = el.scrollHeight > 240 ? "auto" : "hidden";
  }, [input]);

  useEffect(() => () => abortRef.current?.abort(), []);

  function patchLast(patch: (m: Msg) => Msg) {
    setMessages((prev) => {
      const copy = prev.slice();
      const i = copy.length - 1;
      if (i >= 0 && copy[i].role === "assistant") copy[i] = patch(copy[i]);
      return copy;
    });
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy || !aiOnline) return;
    setNotice(null);
    setInput("");
    setBusy(true);
    stickToBottom.current = true;
    setMessages((prev) => [
      ...prev,
      { id: nextTempId(), role: "user", content: message },
      { id: nextTempId(), role: "assistant", content: "", streaming: true },
    ]);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: conversationId ?? undefined, message }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        if (res.status === 401) router.push("/login?next=/command");
        patchLast((m) => ({ ...m, streaming: false, error: data?.error ?? `Request failed (${res.status}).` }));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parsed = parseChatEvents(buffer);
        buffer = parsed.rest;
        for (const event of parsed.events) {
          if (event.type === "meta") {
            if (!conversationId) {
              setConversationId(event.conversationId);
              window.history.replaceState(null, "", `/command?c=${event.conversationId}`);
              setConversations((prev) => [
                { id: event.conversationId, title: message.replace(/\s+/g, " ").slice(0, 60), updatedAt: new Date().toISOString() },
                ...prev.filter((c) => c.id !== event.conversationId),
              ]);
            }
          } else if (event.type === "text") {
            patchLast((m) => ({ ...m, content: m.content + event.text }));
          } else if (event.type === "done") {
            patchLast((m) => ({ ...m, streaming: false, model: event.model, stopReason: event.stopReason }));
          } else if (event.type === "error") {
            patchLast((m) => ({ ...m, streaming: false, error: event.message }));
          }
        }
      }
      patchLast((m) => ({ ...m, streaming: false }));
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === "AbortError";
      patchLast((m) => ({
        ...m,
        streaming: false,
        error: aborted ? undefined : "Connection lost. Your message was saved; try again.",
        stopReason: aborted ? "stopped" : m.stopReason,
      }));
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send(input);
    }
  }

  function newChat() {
    abortRef.current?.abort();
    setConversationId(null);
    setMessages([]);
    setNotice(null);
    setShowHistory(false);
    window.history.replaceState(null, "", "/command");
    inputRef.current?.focus();
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this conversation? This can't be undone.")) return;
    const { ok } = await deleteConversationAction(id);
    if (!ok) {
      setNotice("Couldn't delete that conversation.");
      return;
    }
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (id === conversationId) newChat();
  }

  const modelLabel = (id?: string | null) => (id ? (modelInfo(id)?.label ?? id) : null);

  const textButton = "min-h-10 px-1 text-sm font-semibold underline decoration-1 underline-offset-4 hover:decoration-2";

  return (
    <div className="grid border border-ink lg:h-[calc(100dvh-6rem)] lg:grid-cols-[17rem_1fr]">
      {/* Conversation history */}
      <aside
        className={cx("min-h-0 flex-col border-b border-ink lg:border-b-0 lg:border-r", showHistory ? "flex" : "hidden lg:flex")}
        aria-label="Conversations"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-ink px-4">
          <span className="label">History</span>
          <button type="button" onClick={newChat} className={textButton}>
            New chat
          </button>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto max-lg:max-h-72">
          {conversations.length === 0 ? <li className="px-4 py-4 text-sm text-muted">No conversations yet.</li> : null}
          {conversations.map((c) => {
            const active = c.id === conversationId;
            return (
              <li key={c.id} className={cx("group flex items-stretch border-b border-hair", active && "bg-ink text-paper")}>
                <Link
                  href={`/command?c=${c.id}`}
                  onClick={() => setShowHistory(false)}
                  aria-current={active ? "page" : undefined}
                  className={cx("min-w-0 flex-1 truncate px-4 py-2.5 text-sm", active ? "font-semibold" : "hover:bg-wash")}
                >
                  {c.title}
                </Link>
                <button
                  type="button"
                  onClick={() => void remove(c.id)}
                  className={cx(
                    "w-10 shrink-0 text-base lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100",
                    active ? "lg:opacity-100 hover:bg-paper hover:text-ink" : "hover:bg-ink hover:text-paper",
                  )}
                  aria-label={`Delete conversation: ${c.title}`}
                  title="Delete"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Chat */}
      <section className="flex min-h-[75dvh] min-w-0 flex-col lg:min-h-0" aria-label="Chat with Jody Core">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-ink px-4 sm:px-6">
          <div className="min-w-0">
            <h1 className="font-extrabold tracking-[-0.02em]">Jody Core</h1>
          </div>
          <p className="hidden truncate font-mono text-xs text-muted sm:block">
            {aiOnline ? `${modelLabel(model)} · chat only, no tools yet` : "offline"}
          </p>
          <div className="flex items-center gap-4 lg:hidden">
            <button type="button" onClick={() => setShowHistory((v) => !v)} className={textButton} aria-expanded={showHistory}>
              History
            </button>
            <button type="button" onClick={newChat} className={textButton}>
              New
            </button>
          </div>
        </header>

        <div
          ref={scrollRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
          className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-8"
          aria-live="polite"
        >
          {messages.length === 0 ? (
            <div className="mx-auto max-w-2xl">
              <h2 className="text-4xl font-extrabold leading-[1] tracking-[-0.04em] sm:text-5xl">
                What are we working on, {userName}?
              </h2>
              <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted">
                Jody Core can plan, draft and think things through. It can&apos;t reach your sites or accounts until those
                integrations are connected.
              </p>
              {aiOnline ? (
                <ul className="mt-8 border-t border-ink">
                  {SUGGESTIONS.map((s) => (
                    <li key={s} className="border-b border-hair">
                      <button
                        type="button"
                        onClick={() => void send(s)}
                        className="flex w-full items-center justify-between gap-4 py-3 text-left text-[15px] hover:underline hover:underline-offset-4"
                      >
                        {s}
                        <span aria-hidden="true">→</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <ol className="mx-auto max-w-3xl space-y-8">
              {messages.map((m) =>
                m.role === "user" ? (
                  <li key={m.id} className="flex justify-end">
                    <div className="max-w-[85%] whitespace-pre-wrap break-words bg-ink px-4 py-3 text-[15px] leading-relaxed text-paper">
                      {m.content}
                    </div>
                  </li>
                ) : (
                  <li key={m.id} className="border-l-2 border-ink pl-5">
                    <p className="label mb-2 text-subtle">Jody Core</p>
                    <div className="min-w-0 break-words">
                      {m.content ? <Markdown text={m.content} /> : null}
                      {m.streaming && !m.content ? (
                        <p className="text-[15px] text-muted" role="status">
                          Thinking
                          <Cursor />
                        </p>
                      ) : null}
                      {m.streaming && m.content ? <Cursor /> : null}
                      {m.error ? (
                        <div className="mt-2">
                          <Alert tone="bad">{m.error}</Alert>
                        </div>
                      ) : null}
                      {!m.streaming && !m.error && (m.model || m.stopReason) ? (
                        <p className="mt-3 font-mono text-[11px] text-subtle">
                          {[
                            modelLabel(m.model),
                            m.stopReason === "stopped" ? "stopped" : null,
                            m.stopReason === "max_tokens" ? "cut off at the length limit" : null,
                            m.stopReason === "refusal" ? "declined" : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ),
              )}
            </ol>
          )}
        </div>

        <div className="shrink-0 border-t border-ink p-3 sm:p-4">
          {notice ? (
            <div className="mb-3">
              <Alert tone="bad">{notice}</Alert>
            </div>
          ) : null}
          {aiOnline ? (
            <form onSubmit={onSubmit} className="mx-auto flex max-w-3xl items-stretch">
              <label htmlFor="composer" className="sr-only">
                Message Jody Core
              </label>
              <textarea
                id="composer"
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                maxLength={20000}
                placeholder="Ask Jody Core. Enter to send, Shift+Enter for a new line."
                className="min-h-12 flex-1 resize-none border border-r-0 border-ink px-4 py-3 text-[15px] leading-relaxed placeholder:text-subtle focus:outline-2 focus:-outline-offset-2 focus:outline-ink"
              />
              {busy ? (
                <button
                  type="button"
                  onClick={() => abortRef.current?.abort()}
                  className="min-h-12 shrink-0 border border-ink px-5 text-sm font-semibold hover:bg-ink hover:text-paper"
                >
                  Stop
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="min-h-12 shrink-0 border border-ink bg-ink px-6 text-sm font-semibold text-paper hover:bg-paper hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Send
                </button>
              )}
            </form>
          ) : (
            <Alert tone="warn">
              Jody Core is offline. Add <code className="font-mono">ANTHROPIC_API_KEY</code> to the environment and redeploy.{" "}
              <Link href="/integrations" className="font-semibold underline underline-offset-4">
                Integrations →
              </Link>
            </Alert>
          )}
        </div>
      </section>
    </div>
  );
}
