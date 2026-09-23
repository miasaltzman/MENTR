/** Routes that require a signed-in user. */
export const PROTECTED_PREFIXES = [
  "/home",
  "/roadmap",
  "/explore",
  "/mentor",
  "/profile",
  "/settings",
  "/onboarding",
  "/checkin",
] as const;

export const AUTH_PAGES = ["/login"] as const;

export const DEFAULT_AFTER_LOGIN = "/home";

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Only allow same-origin relative redirects (prevents open redirects such as
 * `//evil.com` or `/\evil.com`).
 */
export function safeNextPath(
  next: string | null | undefined,
  fallback: string = DEFAULT_AFTER_LOGIN,
): string {
  if (!next || typeof next !== "string") return fallback;
  if (
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.startsWith("/\\")
  ) {
    return fallback;
  }
  if (/[\u0000-\u001f]/.test(next)) return fallback;
  return next;
}
