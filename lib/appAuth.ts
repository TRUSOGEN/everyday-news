// Session auth shared by middleware (edge) and API routes — Web Crypto only,
// so it runs in both runtimes.
const enc = new TextEncoder();

export const SESSION_COOKIE = "en_session";

export async function sessionToken(): Promise<string> {
  const secret = process.env.CRON_SECRET ?? "";
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("everyday-news-session"));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
