import type { ReactNode } from "react";
import { languageName, profileName } from "@/lib/agent-input";
import type { Agent } from "@/lib/agents";
import type { AgentLink } from "@/lib/db/schema";
import { Linked, Rows } from "@/components/dashboard/ui";
import { Badge, buttonClass, cx } from "@/components/ui/primitives";
import { CopyButton } from "./embed-tools";

/*
 * One business's website AI assistant, read top to bottom: what visitors
 * see first, what it answers straight away, what it falls back on, the
 * rules it keeps, what it knows, and how to put it on a site.
 */

function Out({ link, className }: { link: AgentLink; className?: string }) {
  const phone = link.url.startsWith("tel:");
  return (
    <a
      href={link.url}
      {...(phone ? {} : { target: "_blank", rel: "noopener noreferrer" })}
      className={cx("inline-flex items-center gap-1 rounded-full bg-paper px-3 py-1 text-sm font-semibold transition-colors hover:bg-ink hover:text-paper", className)}
    >
      {link.label}
      {phone ? null : (
        <>
          <span aria-hidden="true">↗</span>
          <span className="sr-only"> (opens in a new tab)</span>
        </>
      )}
    </a>
  );
}

function Part({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-lg font-extrabold tracking-[-0.01em]">{title}</h4>
        {note ? <span className="text-sm text-muted">{note}</span> : null}
      </div>
      {children}
    </section>
  );
}

const STEPS = [
  "Safety first: a message about a crisis gets the crisis answer below, with no AI involved.",
  "A starter question gets its saved answer instantly.",
  "Anything else goes to the AI, which may only use the knowledge and must keep the rules.",
  "If the AI can't answer, a keyword answer is used; failing that, the links it offers when unsure.",
];

/** The one line a website needs: JodyOS serves the widget and the answers. */
export function embedCode(origin: string, slug: string) {
  return `<script src="${origin}/agent.js" data-agent="${slug}" defer></script>`;
}

export function AgentView({ agent, origin, aiReady }: { agent: Agent; origin: string; aiReady: boolean }) {
  const words = agent.knowledge.split(/\s+/).filter(Boolean).length;
  return (
    <article aria-label={agent.name} className="animate-rise space-y-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-3 text-3xl font-extrabold leading-tight tracking-[-0.03em] sm:text-4xl">
            {agent.brandColor || agent.accentColor ? (
              <span aria-hidden="true" className="flex shrink-0 -space-x-1.5">
                {[agent.brandColor, agent.accentColor].filter(Boolean).map((c) => (
                  <span key={c} className="size-5 rounded-full ring-2 ring-paper" style={{ backgroundColor: c ?? undefined }} />
                ))}
              </span>
            ) : null}
            {agent.name}
          </h3>
          {agent.tagline ? <p className="mt-1 text-muted">{agent.tagline}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge>{languageName(agent.language)}</Badge>
            <Badge>{profileName(agent.safetyProfile)}</Badge>
            <Badge>{agent.starters.length} starter questions</Badge>
          </div>
        </div>
        {agent.ctaUrl && agent.ctaLabel ? (
          <div className="text-right">
            <p className="mb-1 text-sm text-muted">Main button</p>
            <Out link={{ label: agent.ctaLabel, url: agent.ctaUrl }} className="bg-ink text-paper hover:bg-[#262626]" />
          </div>
        ) : null}
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-2">
        <div className="space-y-10">
          <Part title="What visitors see first">
            <div className="space-y-3 rounded-3xl bg-wash p-5">
              <p className="max-w-md rounded-2xl rounded-tl-md bg-paper px-4 py-3 text-[15px] leading-relaxed">{agent.greeting || "(no greeting)"}</p>
              {agent.note ? <p className="text-xs text-muted">{agent.note}</p> : null}
              {agent.starters.length ? (
                <div className="flex flex-wrap gap-2">
                  {agent.starters.map((s) => (
                    <span key={s.question} className="rounded-full border border-line bg-paper px-3 py-1.5 text-sm">
                      {s.question}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </Part>

          <Part title="Starter questions" note="answered instantly">
            {agent.starters.length ? (
              <Rows>
                {agent.starters.map((s) => (
                  <li key={s.question} className="space-y-1.5">
                    <p className="font-bold">{s.question}</p>
                    <p className="whitespace-pre-line text-[15px] leading-relaxed text-muted">{s.answer}</p>
                    {s.link ? <Out link={s.link} /> : null}
                  </li>
                ))}
              </Rows>
            ) : (
              <p className="text-muted">None.</p>
            )}
          </Part>

          <Part title="Keyword answers" note="if the AI can't answer">
            {agent.keywords.length ? (
              <Rows>
                {agent.keywords.map((k, i) => (
                  <li key={i} className="space-y-1.5">
                    <p className="flex flex-wrap gap-1.5">
                      {k.words.map((w) => (
                        <span key={w} className="rounded-md bg-paper px-2 py-0.5 font-mono text-xs">
                          {w}
                        </span>
                      ))}
                    </p>
                    <p className="text-[15px] leading-relaxed text-muted">{k.answer}</p>
                    {k.link ? <Out link={k.link} /> : null}
                  </li>
                ))}
              </Rows>
            ) : (
              <p className="text-muted">None.</p>
            )}
          </Part>

          <Part title="When it isn't sure, it offers">
            <div className="flex flex-wrap gap-2 rounded-2xl bg-wash p-4">
              {agent.fallbackLinks.length ? agent.fallbackLinks.map((l) => <Out key={l.url + l.label} link={l} />) : <span className="text-muted">No links.</span>}
            </div>
          </Part>
        </div>

        <div className="space-y-10">
          <Part title="How it answers">
            <ol className="space-y-2 rounded-2xl bg-wash p-5 text-[15px] leading-relaxed">
              {STEPS.map((s, i) => (
                <li key={s} className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-paper">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </Part>

          {agent.crisis ? (
            <Part title="In a crisis it says">
              <div className="space-y-3 rounded-2xl bg-ink p-5 text-paper">
                <p className="whitespace-pre-line text-[15px] leading-relaxed">{agent.crisis.answer}</p>
                <div className="flex flex-wrap gap-2">
                  {agent.crisis.actions.map((a) => (
                    <Out key={a.url} link={a} className="text-ink" />
                  ))}
                </div>
              </div>
            </Part>
          ) : null}

          {agent.instructions ? (
            <Part title="Its instructions" note="what the AI is told, word for word">
              <details className="group rounded-2xl bg-wash p-5">
                <summary className="cursor-pointer list-none font-semibold">
                  <span className="group-open:hidden">Show the instructions</span>
                  <span className="hidden group-open:inline">Hide the instructions</span>
                </summary>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{agent.instructions}</p>
              </details>
            </Part>
          ) : null}

          <Part title="What it knows" note={`${words.toLocaleString("en-US")} words`}>
            <details className="group rounded-2xl bg-wash p-5">
              <summary className="cursor-pointer list-none font-semibold">
                <span className="group-open:hidden">Show the knowledge</span>
                <span className="hidden group-open:inline">Hide the knowledge</span>
              </summary>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">
                <Linked text={agent.knowledge || "(empty)"} />
              </p>
            </details>
          </Part>

          <Part title="Put it on a website">
            <div className="space-y-3 rounded-2xl bg-wash p-5 text-[15px]">
              <p>Paste this one line on {agent.business.name}&apos;s website, just before the end of the page:</p>
              <code className="block select-all break-all rounded-xl bg-paper px-3 py-2 font-mono text-sm">{embedCode(origin, agent.business.slug)}</code>
              <div className="flex flex-wrap gap-2">
                <CopyButton text={embedCode(origin, agent.business.slug)} />
                <a href={`/analytics/try?agent=${agent.business.slug}`} className={buttonClass("light", "min-h-9 px-4")}>
                  Try it here
                </a>
              </div>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
                <li>Kajabi: Settings → Site → Custom code → Footer.</li>
                <li>WordPress: the theme footer, or a Custom HTML block.</li>
                <li>Sites built with Claude Code (Next.js): ask for it to go in the root layout.</li>
              </ul>
              {aiReady ? null : (
                <p className="text-sm">
                  The AI isn&apos;t switched on yet (ANTHROPIC_API_KEY in Vercel): until it is, the agent answers with its starter and keyword answers and links.
                </p>
              )}
            </div>
          </Part>
        </div>
      </div>

      <p className="text-sm text-muted">
        Imported from the OS Analytics plugin, served by JodyOS. Updated {agent.updatedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.
      </p>
    </article>
  );
}
