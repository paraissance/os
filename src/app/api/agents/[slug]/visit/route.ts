import type { NextRequest } from "next/server";
import { recordVisit } from "@/lib/traffic";

/*
 * Public on purpose: the agent line on a business's website reports each
 * page view here, for the traffic on the dashboard. Only views from the
 * business's own site count. It always answers 204, whether it counted or
 * not, and never says why.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/agents/[slug]/visit">) {
  const { slug } = await ctx.params;
  let firstToday = false;
  try {
    const body = JSON.parse((await req.text()).slice(0, 200)) as { new?: unknown };
    firstToday = body.new === true;
  } catch {
    // An empty or odd body is still a page view.
  }
  try {
    await recordVisit({ slug, origin: req.headers.get("origin"), userAgent: req.headers.get("user-agent"), firstToday, now: new Date() });
  } catch (error) {
    console.error("Visit not counted:", error instanceof Error ? error.name : "unknown error");
  }
  return new Response(null, { status: 204, headers: { ...CORS, "Cache-Control": "no-store" } });
}
