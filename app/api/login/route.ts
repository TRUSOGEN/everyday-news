import { NextResponse } from "next/server";
import { sessionToken, SESSION_COOKIE } from "@/lib/appAuth";

export async function POST(request: Request) {
  const { password } = await request.json().catch(() => ({ password: "" }));
  const expected = process.env.APP_PASSWORD ?? "TRUSO";

  if (password !== expected) {
    return NextResponse.json({ error: "口令错误" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
  return res;
}
