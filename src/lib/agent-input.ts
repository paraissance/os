import { z } from "zod";
import { isHttpUrl } from "@/lib/business-input";

/*
 * The JodyOS agents file: the website AI assistants exported from the OS
 * Analytics plugin, one per business (matched by its short name). Links
 * must be web addresses (crisis buttons may also be phone numbers); a bad
 * link is dropped rather than failing the whole file.
 */

export const AGENTS_FORMAT = "jodyos-agents";

const text = (max: number) => z.string().trim().max(max);
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const link = z.object({ label: text(120).min(1), url: z.string().trim().max(2000).refine(isHttpUrl) });
/** A link, or null when it is missing or not a web address. */
const softLink = link.nullish().catch(null).transform((v) => v ?? null);
const links = z.array(z.unknown()).max(50).transform((items) => items.flatMap((i) => {
  const parsed = link.safeParse(i);
  return parsed.success ? [parsed.data] : [];
}));

const PHONE = /^tel:\+?[0-9]{2,15}$/;
const crisisAction = z.object({ label: text(120).min(1), url: z.string().trim().max(2000).refine((u) => PHONE.test(u) || isHttpUrl(u)) });

const color = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v && /^#[0-9a-f]{3,8}$/i.test(v) ? v : null));

export const agentInput = z.object({
  business: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{0,59}$/, "Not a business short name."),
  name: text(120).min(1),
  tagline: optText(200),
  language: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z]{2}(-[a-z]{2})?$/)
    .catch("en"),
  safetyProfile: optText(40),
  colors: z.object({ brand: color, accent: color }).nullish().catch(null),
  cta: softLink,
  greeting: text(2000).default(""),
  note: optText(500),
  starters: z
    .array(z.object({ question: text(300).min(1), answer: text(5000), link: softLink }))
    .max(50)
    .default([]),
  keywords: z
    .array(z.object({ words: z.array(text(60).min(1)).max(50), answer: text(5000), link: softLink }))
    .max(50)
    .default([]),
  fallbackLinks: links.default([]),
  knowledge: text(60_000).default(""),
  instructions: optText(20_000),
  crisis: z
    .object({ answer: text(3000).min(1), actions: z.array(crisisAction).max(10).default([]) })
    .nullish()
    .catch(null)
    .transform((v) => v ?? null),
  shortcode: optText(200),
});

export const agentsFileSchema = z.object({
  format: z.literal(AGENTS_FORMAT, { error: `Not a JodyOS agents file (format must be "${AGENTS_FORMAT}").` }),
  version: z.literal(1),
  agents: z.array(agentInput).max(100),
});

export type AgentInput = z.infer<typeof agentInput>;
export type AgentsFile = z.infer<typeof agentsFileSchema>;

const LANGUAGES: Record<string, string> = { en: "English", es: "Spanish" };
export function languageName(code: string) {
  return LANGUAGES[code.slice(0, 2)] ?? code.toUpperCase();
}

const PROFILES: Record<string, string> = {
  coaching_us: "Coaching rules (US)",
  insurance_us: "Insurance rules (US)",
  medical_uk: "Medical rules (UK)",
};
export function profileName(profile: string | null) {
  return profile ? (PROFILES[profile] ?? profile.replace(/_/g, " ")) : "Standard rules";
}
