import type { NextRequest } from "next/server";
import { getAgentBySlug } from "@/lib/agents";

/*
 * Public on purpose: the businesses' own websites load their chat agent from
 * here (see public/agent.js). Only what a visitor sees is sent: never the
 * instructions or knowledge.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/** The widget's settings: name, greeting, starter questions, colours. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/agents/[slug]">) {
  const { slug } = await ctx.params;
  const agent = await getAgentBySlug(slug);
  if (!agent) return Response.json({ error: "No agent here." }, { status: 404, headers: CORS });
  return Response.json(
    {
      id: agent.business.slug,
      name: agent.name,
      tagline: agent.tagline,
      greeting: agent.greeting,
      note: agent.note,
      language: agent.language,
      brand: agent.brandColor,
      accent: agent.accentColor,
      starters: agent.starters.map((s) => s.question),
    },
    { headers: { ...CORS, "Cache-Control": "public, max-age=60, s-maxage=300" } },
  );
}
