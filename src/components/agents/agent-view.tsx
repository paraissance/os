import type { ReactNode } from "react";
import { allKnowledge } from "@/lib/agent-engine";
import type { Agent } from "@/lib/agents";
import type { AgentLink } from "@/lib/db/schema";
import { Linked, Rows } from "@/components/dashboard/ui";
import { buttonClass } from "@/components/ui/primitives";
import { CopyButton } from "./embed-tools";

/*
 * One business's website AI assistant: its name, what it holds, and the two
 * things to do with it (try it, copy the line for a website). Everything it
 * says and knows stays one click away.
 */

function Out({ link }: { link: AgentLink }) {
  const phone = link.url.startsWith("tel:");
  return (
    <a
      href={link.url}
      {...(phone ? {} : { target: "_blank", rel: "noopener noreferrer" })}
      className="inline-flex items-center gap-1 rounded-full bg-paper px-3 py-1 text-sm font-semibold text-ink transition-colors hover:bg-mist"
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

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h4 className="text-lg font-extrabold tracking-[-0.01em]">{title}</h4>
      {children}
    </section>
  );
}

/** Long text, folded until it's asked for. */
function Folded({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="rounded-3xl bg-wash p-6">
      <summary className="cursor-pointer font-semibold">{label}</summary>
      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{children}</p>
    </details>
  );
}

/** The one line a website needs: JodyOS serves the widget and the answers. */
export function embedCode(origin: string, slug: string) {
  return `<script src="${origin}/agent.js" data-agent="${slug}" defer></script>`;
}

export function AgentView({ agent, origin, aiReady }: { agent: Agent; origin: string; aiReady: boolean }) {
  const words = allKnowledge(agent).split(/\s+/).filter(Boolean).length;
  const sitePages = agent.siteKnowledge?.match(/^# PAGE: /gm)?.length ?? 0;
  const code = embedCode(origin, agent.business.slug);
  return (
    <article aria-label={agent.name} className="animate-rise space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-wash p-6">
        <div className="min-w-0">
          <h3 className="text-2xl font-extrabold leading-tight tracking-[-0.03em]">{agent.name}</h3>
          <p className="mt-1 text-sm text-muted">
            {agent.starters.length} starter answers · {words.toLocaleString("en-US")} words · {sitePages} website pages read
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/analytics/try?agent=${agent.business.slug}`} className={buttonClass("light", "min-h-9! px-4!")}>
            Try it
          </a>
          <CopyButton text={code} label="Copy website line" />
        </div>
      </header>

      <details className="group/all">
        <summary className={buttonClass("secondary", "min-h-9! px-4! cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>
          <span className="group-open/all:hidden">See what it says and knows</span>
          <span className="hidden group-open/all:inline">Hide what it says and knows</span>
        </summary>
        <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-x-3 gap-y-8 lg:grid-cols-2">
          <div className="min-w-0 space-y-8">
            <Part title="What visitors see first">
              <div className="space-y-3 rounded-3xl bg-wash p-6">
                <p className="max-w-md rounded-2xl rounded-tl-md bg-paper px-4 py-3 text-[15px] leading-relaxed">{agent.greeting || "(no greeting)"}</p>
                {agent.ctaUrl && agent.ctaLabel ? <Out link={{ label: agent.ctaLabel, url: agent.ctaUrl }} /> : null}
              </div>
            </Part>

            {agent.starters.length ? (
              <Part title="Starter answers">
                <Rows>
                  {agent.starters.map((s) => (
                    <li key={s.question} className="space-y-1.5">
                      <p className="font-bold">{s.question}</p>
                      <p className="whitespace-pre-line text-[15px] leading-relaxed text-muted">{s.answer}</p>
                      {s.link ? <Out link={s.link} /> : null}
                    </li>
                  ))}
                </Rows>
              </Part>
            ) : null}

            {agent.keywords.length ? (
              <Part title="Keyword answers">
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
              </Part>
            ) : null}

            {agent.fallbackLinks.length ? (
              <Part title="When it isn't sure, it offers">
                <div className="flex flex-wrap gap-2 rounded-3xl bg-wash p-6">
                  {agent.fallbackLinks.map((l) => (
                    <Out key={l.url + l.label} link={l} />
                  ))}
                </div>
              </Part>
            ) : null}
          </div>

          <div className="min-w-0 space-y-8">
            {agent.crisis ? (
              <Part title="In a crisis it says">
                <div className="space-y-3 rounded-3xl bg-ink p-6 text-paper">
                  <p className="whitespace-pre-line text-[15px] leading-relaxed">{agent.crisis.answer}</p>
                  <div className="flex flex-wrap gap-2">
                    {agent.crisis.actions.map((a) => (
                      <Out key={a.url} link={a} />
                    ))}
                  </div>
                </div>
              </Part>
            ) : null}

            <Part title="What it knows">
              {agent.instructions ? <Folded label="Its instructions">{agent.instructions}</Folded> : null}
              <Folded label={`Its knowledge, ${words.toLocaleString("en-US")} words`}>
                <Linked text={agent.knowledge || "(empty)"} />
              </Folded>
              {agent.siteKnowledge ? (
                <Folded label={`From its website, ${sitePages} page${sitePages === 1 ? "" : "s"}`}>
                  <Linked text={agent.siteKnowledge} />
                </Folded>
              ) : null}
            </Part>

            <Part title="Put it on a website">
              <div className="space-y-3 rounded-3xl bg-wash p-6 text-[15px]">
                <code className="block select-all break-all rounded-xl bg-paper px-3 py-2 font-mono text-sm">{code}</code>
                <p className="text-sm text-muted">Paste it just before the end of the page, or in the site&apos;s footer code.</p>
                {aiReady ? null : <p className="text-sm">The AI isn&apos;t on yet (ANTHROPIC_API_KEY in Vercel), so it uses saved answers only.</p>}
              </div>
            </Part>
          </div>
        </div>
      </details>
    </article>
  );
}
