import { createHmac } from "crypto";

// Daily-rotating token derived from CRON_SECRET, safe to embed in the page.
// Knowing the token only allows triggering /api/generate for the current day;
// the raw CRON_SECRET never reaches the browser.
function tokenForDay(day: string): string {
  return createHmac("sha256", process.env.CRON_SECRET ?? "")
    .update(`generate:${day}`)
    .digest("hex");
}

export function dailyGenerateToken(): string {
  return tokenForDay(new Date().toISOString().slice(0, 10));
}

export function isValidGenerateToken(token: string): boolean {
  if (!token) return false;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 86400_000).toISOString().slice(0, 10);
  return token === tokenForDay(today) || token === tokenForDay(yesterday);
}
