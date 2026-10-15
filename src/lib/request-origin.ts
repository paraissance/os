import "server-only";
import { headers } from "next/headers";

/** Where this JodyOS is reached, like https://jodyos.vercel.app: the websites load the agent line from here. */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "jodyos.vercel.app";
  return `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
}
