/**
 * Keeps secrets out of logs and API responses. Pure functions, no I/O.
 */
const SECRET_KEY = /pass(word|wd|phrase)?|secret|token|api[-_]?key|authori[sz]ation|cookie|session|credential|private[-_]?key/i;

const MAX_DEPTH = 5;
const MAX_ARRAY = 50;
const MAX_STRING = 2000;

export function truncate(value: string | null | undefined, max: number): string | null {
  if (value == null) return null;
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function redactSecrets(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[truncated]";
  if (typeof value === "string") return truncate(value, MAX_STRING);
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY).map((v) => redactSecrets(v, depth + 1));
  }
  if (value && typeof value === "object") {
    if (value instanceof Date) return value.toISOString();
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SECRET_KEY.test(k) ? "[redacted]" : redactSecrets(v, depth + 1);
    }
    return out;
  }
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function" || typeof value === "symbol") return undefined;
  return value;
}

/** Remove anything shaped like a credential from free text (e.g. provider error messages). */
export function scrubText(text: string): string {
  return text
    .replace(/sk-ant-[A-Za-z0-9_-]{8,}/g, "[redacted-key]")
    .replace(/\b(sk|pk|rk)-[A-Za-z0-9_-]{16,}/g, "[redacted-key]")
    .replace(/(postgres(?:ql)?:\/\/[^:\s]+:)[^@\s]+@/gi, "$1[redacted]@")
    .replace(/(bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi, "$1[redacted]");
}
