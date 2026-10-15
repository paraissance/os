import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_DEV, SESSION_COOKIE_PROD } from "@/lib/auth/cookie";

/**
 * Optimistic gate: without a session cookie, send page requests to /login
 * before rendering anything. The real check (is the session valid?) happens
 * in the Data Access Layer on every data read, action and API call.
 */
const PUBLIC = ["/login", "/setup"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();

  const hasSession = request.cookies.has(SESSION_COOKIE_PROD) || request.cookies.has(SESSION_COOKIE_DEV);
  if (hasSession) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except API routes (they answer 401 themselves), Next internals and public files
  // (agent.js is the website chat widget, loaded by the businesses' own sites).
  matcher: ["/((?!api/|_next/static|_next/image|icon.svg|robots.txt|favicon.ico|agent.js).*)"],
};
