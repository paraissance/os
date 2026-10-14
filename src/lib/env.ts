import "server-only";
import { z } from "zod";

/**
 * Server-side environment. Read lazily (never at module load) so `next build`
 * works without secrets, and validated so a bad value fails loudly instead of
 * half-working. Nothing in here may be imported by a Client Component.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  VERCEL: z.string().optional(),
  DATABASE_URL: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => v === undefined || /^postgres(ql)?:\/\//.test(v), {
      message: "DATABASE_URL must start with postgres:// or postgresql://",
    }),
  PGLITE_DATA_DIR: z.string().trim().default(".data/pglite"),
  SETUP_TOKEN: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined)),
  ANTHROPIC_API_KEY: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined)),
  AI_MODEL: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined)),
  // OS Analytics (WordPress plugin) connector: the endpoint shown on the
  // plugin's Settings → JodyOS connection card, and the key generated there.
  OS_ANALYTICS_URL: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.replace(/\/+$/, "") : undefined))
    .refine((v) => v === undefined || /^https?:\/\/[^\s]+$/i.test(v), {
      message: "OS_ANALYTICS_URL must be an http(s) URL",
    }),
  OS_ANALYTICS_KEY: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined)),
  // Blotato: social accounts, posts, schedule and analytics (read-only for now).
  BLOTATO_API_KEY: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined)),
  // Email (Resend): sends the 6-digit sign-in codes. EMAIL_FROM is a sender
  // on a domain verified in Resend, like "JodyOS <login@example.com>".
  RESEND_API_KEY: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined)),
  EMAIL_FROM: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => v === undefined || /^(?:[^<>@\r\n]+<)?[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>?$/.test(v), {
      message: 'EMAIL_FROM must be an email address, like "JodyOS <login@example.com>"',
    }),
});

export type ServerEnv = z.infer<typeof schema>;

export class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnvError";
  }
}

export function parseEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = schema.safeParse(source);
  if (!result.success) {
    // Only variable names and rule messages: never echo a value back.
    const issues = result.error.issues
      .map((i) => `${i.path.join(".") || "env"}: ${i.message}`)
      .join("; ");
    throw new EnvError(`Invalid environment configuration (${issues})`);
  }
  const env = result.data;
  if (env.VERCEL && !env.DATABASE_URL) {
    throw new EnvError(
      "DATABASE_URL is required on Vercel. Add a Postgres database (e.g. Neon from the Vercel Marketplace) and redeploy.",
    );
  }
  if (env.SETUP_TOKEN && env.SETUP_TOKEN.length < 24) {
    throw new EnvError("SETUP_TOKEN must be at least 24 characters long.");
  }
  if (env.NODE_ENV === "production" && env.OS_ANALYTICS_URL?.startsWith("http://")) {
    throw new EnvError("OS_ANALYTICS_URL must use https:// in production (the key travels with every request).");
  }
  return env;
}

let cached: ServerEnv | undefined;

export function env(): ServerEnv {
  cached ??= parseEnv(process.env);
  return cached;
}

export const isProduction = () => env().NODE_ENV === "production";

/** Which optional services are configured. Booleans only, never values. */
export function envStatus() {
  const e = env();
  return {
    database: e.DATABASE_URL ? ("postgres" as const) : ("pglite" as const),
    setupToken: Boolean(e.SETUP_TOKEN),
    anthropic: Boolean(e.ANTHROPIC_API_KEY),
    osAnalytics: Boolean(e.OS_ANALYTICS_URL && e.OS_ANALYTICS_KEY),
    email: Boolean(e.RESEND_API_KEY && e.EMAIL_FROM),
    blotato: Boolean(e.BLOTATO_API_KEY),
  };
}
