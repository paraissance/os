/**
 * The JodyOS module map: one list drives the sidebar, the dashboard roadmap
 * and the "coming in Phase N" pages, so a module goes live by flipping its
 * `phase` once its real page replaces the placeholder.
 */
export type ModuleGroup = "Core" | "Business" | "Operations" | "System";

export type ModuleDef = {
  id: string;
  label: string;
  href: string;
  group: ModuleGroup;
  /** The phase that delivers the module; 1 = available now. */
  phase: 1 | 2 | 3 | 4 | 5 | 6;
  summary: string;
  planned: string[];
};

export const PHASES: Record<ModuleDef["phase"], string> = {
  1: "Foundation",
  2: "Jody Core",
  3: "Integrations",
  4: "Automation",
  5: "Agents",
  6: "Advanced",
};

export const MODULES: ModuleDef[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/",
    group: "Core",
    phase: 1,
    summary: "System status, recent activity and what needs attention.",
    planned: [],
  },
  {
    id: "command",
    label: "AI Command",
    href: "/command",
    group: "Core",
    phase: 1,
    summary: "Talk to Jody Core. Phase 1 is chat; tools, planning and permissions arrive in Phase 2.",
    planned: [
      "Understand, plan, pick a tool, check permissions, execute, verify, log, respond",
      "Confirmation prompts for write and destructive actions",
    ],
  },
  {
    id: "businesses",
    label: "Businesses",
    href: "/businesses",
    group: "Business",
    phase: 1,
    summary: "Every business: details, websites and renewals, links, common questions and subscriptions. Optional live numbers from OS Analytics.",
    planned: [],
  },
  {
    id: "websites",
    label: "Websites",
    href: "/websites",
    group: "Business",
    phase: 3,
    summary: "All sites across WordPress, Vercel and GitHub, with deploy and health status.",
    planned: [
      "Domain, business, platform, hosting, repo, deploy provider",
      "Status and last deploy pulled live from GitHub and Vercel",
      "Analytics and SEO per site",
    ],
  },
  {
    id: "social",
    label: "Social",
    href: "/social",
    group: "Business",
    phase: 3,
    summary: "Plan, create and schedule posts across every business's channels.",
    planned: [
      "Facebook, Instagram, YouTube, Pinterest, X and more",
      "Blotato as a pluggable publishing provider",
      "Post status, errors, media and a business filter",
    ],
  },
  {
    id: "analytics",
    label: "Analytics",
    href: "/analytics",
    group: "Business",
    phase: 3,
    summary: "Traffic and conversions per business, starting with Google Analytics 4.",
    planned: [
      "Users, sessions, sources, top pages, conversions",
      "Trends and period comparisons",
      "More providers later",
    ],
  },
  {
    id: "tasks",
    label: "Tasks",
    href: "/tasks",
    group: "Operations",
    phase: 2,
    summary: "Work items Jody Core creates, runs and reports on.",
    planned: [
      "Title, description, business, project, priority, dates, tools, history",
      "Pending, Running, Waiting, Completed, Failed, Cancelled",
    ],
  },
  {
    id: "automations",
    label: "Automations",
    href: "/automations",
    group: "Operations",
    phase: 4,
    summary: "Scheduled, recurring and conditional jobs with monitoring and notifications.",
    planned: ["Scheduler and recurring tasks", "Conditions and monitors", "Notifications and run history"],
  },
  {
    id: "agents",
    label: "Agents",
    href: "/agents",
    group: "Operations",
    phase: 5,
    summary: "Specialist agents coordinated by Jody Core, sharing the same tools, permissions and logs.",
    planned: ["SEO, Website, Social, Analytics, Content and Reporting agents", "One permission model and audit trail"],
  },
  {
    id: "memory",
    label: "Memory",
    href: "/memory",
    group: "Operations",
    phase: 2,
    summary: "What Jody Core remembers about you, each business, project and task.",
    planned: ["User, business, project and task memory", "Review and edit what is remembered", "No complex RAG in v1"],
  },
  {
    id: "activity",
    label: "Activity",
    href: "/activity",
    group: "System",
    phase: 1,
    summary: "The audit trail: every request, decision, tool call, result and error.",
    planned: [],
  },
  {
    id: "integrations",
    label: "Integrations",
    href: "/integrations",
    group: "System",
    phase: 1,
    summary: "Connected services and what each one is allowed to do.",
    planned: [],
  },
  {
    id: "settings",
    label: "Settings",
    href: "/settings",
    group: "System",
    phase: 1,
    summary: "Profile, AI behaviour, security and environment.",
    planned: [],
  },
];

export const MODULE_GROUPS: ModuleGroup[] = ["Core", "Business", "Operations", "System"];

export function getModule(id: string): ModuleDef {
  const m = MODULES.find((x) => x.id === id);
  if (!m) throw new Error(`Unknown module: ${id}`);
  return m;
}
