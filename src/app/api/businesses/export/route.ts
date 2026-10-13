import { logActivity } from "@/lib/activity";
import { getSession } from "@/lib/auth/current-user";
import { exportBook } from "@/lib/businesses";

/** Download every business as a JodyOS businesses file (the same format Import reads). */
export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in first." }, { status: 401 });

  const now = new Date();
  const file = await exportBook(now);
  await logActivity({
    action: "business.exported",
    status: "success",
    userId: session.user.id,
    result: `Exported ${file.businesses.length} business${file.businesses.length === 1 ? "" : "es"}`,
  });
  return new Response(`${JSON.stringify(file, null, 2)}\n`, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="jodyos-businesses-${now.toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
