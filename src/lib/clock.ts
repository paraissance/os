/**
 * The request's notion of "now". Server Components call this once per render
 * and pass the value down, so every timestamp on a page agrees. (Only call it
 * after a runtime read such as requireUser(), which keeps it out of prerendering.)
 */
export function requestNow(): Date {
  return new Date();
}

export const DAY_MS = 24 * 60 * 60 * 1000;
