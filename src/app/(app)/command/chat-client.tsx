"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { deleteConversationAction } from "@/app/actions/chat";
import { modelInfo } from "@/lib/ai/models";
import { parseChatEvents } from "@/lib/chat-events";
import { Markdown } from "@/components/markdown";
import { Alert, buttonClass, cx } from "@/components/ui/primitives";

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
  "Plan my week across all my businesses",
  "Draft three social post ideas for Done For You Leads",
  "Outline what the GitHub and Vercel integrations should check",
];

let tempId = 0;
const nextTempId = () => `tmp-${++tempId}`;

function Cursor() {
  return <span className="ml-0.5 inline-block h-[1.05em] w-2 translate-y-[0.15em] rounded-[2px] bg-ink animate-blink" aria-hidden="true" />;
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

  const pillButton = "min-h-9 rounded-full bg-paper px-3.5 text-sm font-semibold transition-colors duration-200 hover:bg-mist";

  return (
    <div className="grid gap-3 lg:h-[calc(100dvh-6rem)] lg:grid-cols-[17rem_1fr]">
      {/* Conversation history */}
      <aside
        className={cx("min-h-0 flex-col overflow-hidden rounded-3xl bg-wash", showHistory ? "flex animate-rise" : "hidden lg:flex")}
        aria-label="Conversations"
      >
        <div className="flex h-14 shrink-0 items-center justify-between px-4">
          <span className="font-bold">History</span>
          <button type="button" onClick={newChat} className={pillButton}>
            + New chat
          </button>
        </div>
        <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2 max-lg:max-h-72">
          {conversations.length === 0 ? <li className="px-3 py-3 text-sm text-muted">No conversations yet.</li> : null}
          {conversations.map((c) => {
            const active = c.id === conversationId;
            return (
              <li key={c.id} className={cx("group flex items-stretch overflow-hidden rounded-xl transition-colors", active ? "bg-ink text-paper" : "hover:bg-mist")}>
                <Link
                  href={`/command?c=${c.id}`}
                  onClick={() => setShowHistory(false)}
                  aria-current={active ? "page" : undefined}
                  className={cx("min-w-0 flex-1 truncate px-3 py-2.5 text-sm", active && "font-semibold")}
                >
                  {c.title}
                </Link>
                <button
                  type="button"
                  onClick={() => void remove(c.id)}
                  className={cx(
                    "w-10 shrink-0 text-base transition-opacity lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100",
                    active ? "lg:opacity-100 hover:bg-[#262626]" : "hover:bg-ink hover:text-paper",
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
      <section
        className="flex min-h-[75dvh] min-w-0 animate-rise flex-col overflow-hidden rounded-3xl border border-hair lg:min-h-0"
        aria-label="Chat with Jody Core"
      >
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-hair px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-full bg-ink text-sm font-bold text-paper">
              J
            </span>
            <h1 className="font-extrabold tracking-[-0.02em]">Jody Core</h1>
          </div>
          <p className="hidden truncate text-xs text-muted sm:block">
            {aiOnline ? `${modelLabel(model)} · chat only, no tools yet` : "offline"}
          </p>
          <div className="flex items-center gap-2 lg:hidden">
            <button type="button" onClick={() => setShowHistory((v) => !v)} className={cx(pillButton, "bg-wash")} aria-expanded={showHistory}>
              History
            </button>
            <button type="button" onClick={newChat} className={cx(pillButton, "bg-wash")}>
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
                <ul className="stagger mt-8 space-y-2">
                  {SUGGESTIONS.map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        onClick={() => void send(s)}
                        className="group flex w-full items-center justify-between gap-4 rounded-2xl bg-wash px-5 py-3.5 text-left text-[15px] font-medium transition-[background-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-mist"
                      >
                        {s}
                        <span aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1">
                          →
                        </span>
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
                  <li key={m.id} className="flex animate-rise justify-end">
                    <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-3xl rounded-br-md bg-ink px-4 py-3 text-[15px] leading-relaxed text-paper">
                      {m.content}
                    </div>
                  </li>
                ) : (
                  <li key={m.id} className="flex animate-rise gap-3">
                    <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-paper">
                      J
                    </span>
                    <div className="min-w-0 flex-1 break-words pt-1">
                    <p className="sr-only">Jody Core:</p>
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
                        <p className="mt-3 text-xs text-muted">
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

        <div className="shrink-0 p-3 sm:p-4">
          {notice ? (
            <div className="mb-3">
              <Alert tone="bad">{notice}</Alert>
            </div>
          ) : null}
          {aiOnline ? (
            <form
              onSubmit={onSubmit}
              className="mx-auto flex max-w-3xl items-end gap-2 rounded-3xl border border-line bg-paper p-1.5 pl-4 transition-colors focus-within:border-ink hover:border-ink"
            >
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
                className="min-h-10 flex-1 resize-none bg-transparent py-2 text-[15px] leading-relaxed placeholder:text-subtle focus:outline-none"
              />
              {busy ? (
                <button
                  type="button"
                  onClick={() => abortRef.current?.abort()}
                  className={buttonClass("secondary", "min-h-10 shrink-0")}
                >
                  Stop
                </button>
              ) : (
                <button type="submit" disabled={!input.trim()} className={buttonClass("primary", "min-h-10 shrink-0")}>
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
