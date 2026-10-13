import "server-only";
import { envStatus } from "@/lib/env";

export type IntegrationStatus = "connected" | "not_configured" | "planned";

export type Integration = {
  id: string;
  name: string;
  category: "AI" | "Code & hosting" | "Websites" | "Social" | "Analytics" | "Messaging" | "Tools";
  phase: number;
  description: string;
  status: IntegrationStatus;
  /** Environment variables the integration reads. Names only, never values. */
  envVars: string[];
  setup: string;
};

/**
 * Status comes from real configuration, never from sample data. Phase 1 has
 * one live integration (Anthropic); the rest are listed so the plan is
 * visible, and each is marked planned until its phase ships.
 */
export function listIntegrations(): Integration[] {
  const env = envStatus();
  return [
    {
      id: "anthropic",
      name: "Anthropic Claude",
      category: "AI",
      phase: 1,
      description: "Powers Jody Core in AI Command.",
      status: env.anthropic ? "connected" : "not_configured",
      envVars: ["ANTHROPIC_API_KEY", "AI_MODEL (optional)"],
      setup: "Create an API key at console.anthropic.com, add it as ANTHROPIC_API_KEY, then restart or redeploy.",
    },
    {
      id: "os-analytics",
      name: "OS Analytics",
      category: "Analytics",
      phase: 1,
      description:
        "Optional. Adds live numbers from the WordPress plugin to each business: leads, pipeline, marketing spend, social, campaigns and tasks. Read-only. Business details work without it.",
      status: env.osAnalytics ? "connected" : "not_configured",
      envVars: ["OS_ANALYTICS_URL", "OS_ANALYTICS_KEY"],
      setup:
        "Install OS Analytics 1.3.0+ on the WordPress site, then Settings → JodyOS connection → Generate key. Add the endpoint and key in Vercel and redeploy.",
    },
    {
      id: "openai",
      name: "OpenAI",
      category: "AI",
      phase: 2,
      description: "Second AI provider behind the same provider interface.",
      status: "planned",
      envVars: ["OPENAI_API_KEY"],
      setup: "Arrives with the provider abstraction in Phase 2.",
    },
    {
      id: "github",
      name: "GitHub",
      category: "Code & hosting",
      phase: 3,
      description: "Repositories, commits and pull requests for your sites.",
      status: "planned",
      envVars: ["GITHUB_TOKEN"],
      setup: "Phase 3, first integration: a fine-grained token limited to the repos JodyOS should see.",
    },
    {
      id: "vercel",
      name: "Vercel",
      category: "Code & hosting",
      phase: 3,
      description: "Deployments and their status, e.g. McNamer's latest deploy.",
      status: "planned",
      envVars: ["VERCEL_TOKEN"],
      setup: "Phase 3, after GitHub: a scoped Vercel access token.",
    },
    {
      id: "wordpress",
      name: "WordPress",
      category: "Websites",
      phase: 3,
      description: "Site health, posts and updates on WordPress sites.",
      status: "planned",
      envVars: [],
      setup: "Phase 3: an Application Password per site, stored encrypted per website rather than in env.",
    },
    {
      id: "blotato",
      name: "Blotato",
      category: "Social",
      phase: 3,
      description: "Publishing and scheduling across social channels.",
      status: "planned",
      envVars: ["BLOTATO_API_KEY"],
      setup: "Phase 3: pluggable social publishing provider.",
    },
    {
      id: "ga4",
      name: "Google Analytics 4",
      category: "Analytics",
      phase: 3,
      description: "Users, sessions, sources, top pages and conversions per site.",
      status: "planned",
      envVars: ["GOOGLE_SERVICE_ACCOUNT_JSON"],
      setup: "Phase 3: a service account with Viewer access to each GA4 property.",
    },
    {
      id: "email",
      name: "Email",
      category: "Messaging",
      phase: 4,
      description: "Notifications and reports by email.",
      status: "planned",
      envVars: [],
      setup: "Phase 4, with notifications.",
    },
    {
      id: "mcp",
      name: "MCP servers",
      category: "Tools",
      phase: 6,
      description: "Plug external tool servers into the tool registry.",
      status: "planned",
      envVars: [],
      setup: "Phase 6.",
    },
  ];
}
