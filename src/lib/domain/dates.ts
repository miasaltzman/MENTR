/** YYYY-MM-DD for "today" in the user's timezone (falls back to UTC). */
export function localDate(
  timezone: string | null | undefined,
  now: Date = new Date(),
): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** ISO week start (Monday) for a YYYY-MM-DD date. */
export function weekStart(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const dow = d.getUTCDay() || 7; // Sunday → 7
  d.setUTCDate(d.getUTCDate() - (dow - 1));
  return d.toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Local hour (0-23) in the user's timezone, for greetings. */
export function localHour(
  timezone: string | null | undefined,
  now: Date = new Date(),
): number {
  try {
    const h = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "UTC",
      hour: "numeric",
      hourCycle: "h23",
    }).format(now);
    return Number(h) % 24;
  } catch {
    return now.getUTCHours();
  }
}

export function greetingFor(hour: number): string {
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
