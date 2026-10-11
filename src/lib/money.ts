/** Money with either a symbol ("$") or an ISO code ("USD"). Shared by server and client code. */
export function formatMoney(value: number, currency: string, fractionDigits?: number): string {
  const digits = fractionDigits ?? (Number.isInteger(value) ? 0 : 2);
  if (/^[A-Z]{3}$/.test(currency)) {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(value);
    } catch {
      // Unknown code: fall through to the plain format.
    }
  }
  const n = new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(Math.abs(value));
  return `${value < 0 ? "-" : ""}${currency || "$"}${n}`;
}
