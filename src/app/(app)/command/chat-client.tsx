"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUpRight, History, MessageSquare, Plus, Send, Sparkles, Square, Trash } from "lucide-react";
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

  return (
    <div className="grid gap-4 lg:h-[calc(100dvh-5rem)] lg:grid-cols-[16rem_1fr]">
      {/* Conversation history */}
      <aside className={cx("panel flex min-h-0 flex-col", showHistory ? "flex" : "hidden lg:flex")} aria-label="Conversations">
        <div className="flex items-center justify-between gap-2 border-b border-line p-3">
          <span className="px-1 font-mono text-[11px] uppercase tracking-[0.16em] text-subtle">History</span>
          <button
            type="button"
            onClick={newChat}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line-strong px-2.5 text-sm text-fg hover:bg-white/[0.06]"
          >
            <Plus className="size-4" aria-hidden="true" /> New
          </button>
        </div>
        <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2 max-lg:max-h-72">
          {conversations.length === 0 ? <li className="px-2 py-3 text-sm text-subtle">No conversations yet.</li> : null}
          {conversations.map((c) => (
            <li key={c.id} className="group relative">
              <Link
                href={`/command?c=${c.id}`}
                onClick={() => setShowHistory(false)}
                aria-current={c.id === conversationId ? "page" : undefined}
                className={cx(
                  "flex min-h-10 items-center gap-2 rounded-lg py-2 pl-2.5 pr-10 text-sm",
                  c.id === conversationId ? "bg-white/[0.07] text-fg" : "text-muted hover:bg-white/[0.04] hover:text-fg",
                )}
              >
                <MessageSquare className="size-3.5 shrink-0 text-subtle" aria-hidden="true" />
                <span className="truncate">{c.title}</span>
              </Link>
              <button
                type="button"
                onClick={() => void remove(c.id)}
                className="absolute right-1 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-subtle opacity-100 hover:bg-white/[0.08] hover:text-bad focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                aria-label={`Delete conversation: ${c.title}`}
              >
                <Trash className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Chat */}
      <section className="panel flex min-h-[70dvh] min-w-0 flex-col lg:min-h-0" aria-label="Chat with Jody Core">
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent/25 to-violet/25 ring-1 ring-line-strong">
              <Sparkles className="size-4 text-accent" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="text-[15px] font-semibold text-fg">Jody Core</h1>
              <p className="truncate text-xs text-subtle">
                {aiOnline ? `${modelLabel(model)} · chat only in Phase 1, no tools yet` : "Offline"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="inline-flex size-10 items-center justify-center rounded-xl text-muted hover:bg-white/[0.06] hover:text-fg lg:hidden"
              aria-label="Show conversation history"
              aria-expanded={showHistory}
            >
              <History className="size-4" />
            </button>
            <button
              type="button"
              onClick={newChat}
              className="inline-flex size-10 items-center justify-center rounded-xl text-muted hover:bg-white/[0.06] hover:text-fg lg:hidden"
              aria-label="New conversation"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </header>

        <div
          ref={scrollRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          }}
          className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6"
          aria-live="polite"
        >
          {messages.length === 0 ? (
            <div className="mx-auto flex max-w-xl flex-col items-center py-10 text-center animate-fade-up">
              <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/20 to-violet/20 ring-1 ring-line-strong">
                <Sparkles className="size-6 text-accent" aria-hidden="true" />
              </span>
              <h2 className="text-xl font-semibold tracking-tight">What are we working on, {userName}?</h2>
              <p className="mt-2 text-sm text-muted">
                Jody Core can plan, draft and think things through. It can&apos;t reach your sites or accounts until those
                integrations are connected.
              </p>
              {aiOnline ? (
                <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void send(s)}
                      className="rounded-xl border border-line bg-white/[0.02] px-4 py-3 text-left text-sm text-muted transition-colors hover:border-line-strong hover:text-fg"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <ol className="mx-auto max-w-3xl space-y-6">
              {messages.map((m) =>
                m.role === "user" ? (
                  <li key={m.id} className="flex justify-end">
                    <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md border border-accent/20 bg-accent/10 px-4 py-2.5 text-[15px] text-fg">
                      {m.content}
                    </div>
                  </li>
                ) : (
                  <li key={m.id} className="flex gap-3">
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent/25 to-violet/25 ring-1 ring-line-strong">
                      <Sparkles className="size-3.5 text-accent" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1 break-words">
                      {m.content ? <Markdown text={m.content} /> : null}
                      {m.streaming && !m.content ? (
                        <p className="flex items-center gap-2 text-sm text-subtle" role="status">
                          <span className="size-2 rounded-full bg-accent animate-pulse-soft" aria-hidden="true" /> Thinking…
                        </p>
                      ) : null}
                      {m.streaming && m.content ? (
                        <span className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 bg-accent/70 animate-pulse-soft" aria-hidden="true" />
                      ) : null}
                      {m.error ? (
                        <div className="mt-2">
                          <Alert tone="bad">{m.error}</Alert>
                        </div>
                      ) : null}
                      {!m.streaming && !m.error && (m.model || m.stopReason) ? (
                        <p className="mt-2 font-mono text-[11px] text-subtle">
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

        <div className="border-t border-line p-3 sm:p-4">
          {notice ? (
            <div className="mb-3">
              <Alert tone="bad">{notice}</Alert>
            </div>
          ) : null}
          {aiOnline ? (
            <form onSubmit={onSubmit} className="mx-auto flex max-w-3xl items-end gap-2">
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
                placeholder="Ask Jody Core…  (Enter to send, Shift+Enter for a new line)"
                className="min-h-11 flex-1 resize-none rounded-xl border border-line-strong bg-ink-900/80 px-3.5 py-2.5 text-[15px] leading-relaxed text-fg placeholder:text-subtle focus:border-accent/60 focus:outline-none"
              />
              {busy ? (
                <button
                  type="button"
                  onClick={() => abortRef.current?.abort()}
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-line-strong bg-white/[0.05] text-fg hover:bg-white/[0.1]"
                  aria-label="Stop generating"
                >
                  <Square className="size-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-accent-strong to-violet text-ink-950 disabled:opacity-40"
                  aria-label="Send"
                >
                  <Send className="size-4" />
                </button>
              )}
            </form>
          ) : (
            <Alert tone="warn">
              Jody Core is offline. Add <code className="font-mono">ANTHROPIC_API_KEY</code> to the environment and restart.{" "}
              <Link href="/integrations" className="inline-flex items-center gap-1 underline underline-offset-4">
                Integrations <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </Link>
            </Alert>
          )}
        </div>
      </section>
    </div>
  );
}
