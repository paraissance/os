/**
 * Session cookie naming. Edge-safe (no Node APIs) because proxy.ts imports it.
 * In production the __Host- prefix makes the browser enforce Secure, Path=/
 * and no Domain attribute, so a subdomain can't plant or read the cookie.
 */
export const SESSION_COOKIE_PROD = "__Host-jodyos_session";
export const SESSION_COOKIE_DEV = "jodyos_session";

export function sessionCookieName(production: boolean) {
  return production ? SESSION_COOKIE_PROD : SESSION_COOKIE_DEV;
}
