/**
 * The dashboard's business tabs: `/?b=<slug>` opens a business and `&s=<id>`
 * one of its sections. Shared by server and client code, so no server imports.
 */

export const SECTIONS = [
  { id: "summary", label: "Summary" },
  { id: "about", label: "About" },
  { id: "links", label: "Links" },
  { id: "money", label: "Money" },
  { id: "website", label: "Website" },
  { id: "marketing", label: "Marketing" },
  { id: "leads", label: "Leads" },
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];

export function isSection(value: unknown): value is SectionId {
  return SECTIONS.some((s) => s.id === value);
}

/** Dashboard URL for a business, optionally on a section (Summary is the default). */
export function businessHref(slug: string, section?: SectionId): string {
  const b = `/?b=${encodeURIComponent(slug)}`;
  return section && section !== "summary" ? `${b}&s=${section}` : b;
}
