/** The dashboard tab of one business: `/?b=<slug>`. Shared by server and client code, so no server imports. */
export function businessHref(slug: string): string {
  return `/?b=${encodeURIComponent(slug)}`;
}

/** Where a business's details are edited, at one part (`websites`, `subscriptions`…). */
export function editHref(slug: string, part?: string): string {
  return `/businesses/${encodeURIComponent(slug)}/edit${part ? `#${part}` : ""}`;
}
