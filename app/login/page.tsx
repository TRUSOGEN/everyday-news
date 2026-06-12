"use client";

import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "登录失败");
      }
      const from = new URLSearchParams(window.location.search).get("from");
      window.location.href = from && from.startsWith("/") ? from : "/config";
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-950 via-stone-900 to-stone-800 px-4"
      style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}
    >
      <div className="w-full max-w-sm animate-fade-in-up">
        <div className="text-center mb-8">
          <h1
            className="text-4xl font-bold text-white tracking-tight"
            style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}
          >
            Everyday News
          </h1>
          <p className="text-stone-400 text-sm mt-3">请输入访问口令</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="口令"
            autoFocus
            className="w-full bg-stone-800/70 border border-stone-700 rounded-xl px-5 py-3.5 text-white text-center text-lg tracking-widest outline-none focus:border-stone-400 placeholder:text-stone-500 placeholder:tracking-normal placeholder:text-sm transition-colors"
          />

          {error && (
            <p className="text-red-400 text-sm text-center animate-fade-in">{error}</p>
          )}

          <button
            type="submit"
            disabled={busy || !password}
            className="w-full bg-white text-stone-900 py-3.5 rounded-xl text-sm font-bold hover:bg-stone-200 transition-all duration-200 disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {busy ? (
              <span className="w-4 h-4 border-2 border-stone-900 border-t-transparent rounded-full animate-spin" />
            ) : (
              "进入"
            )}
          </button>
        </form>

        <div className="h-[3px] accent-gradient rounded-full mt-10 opacity-60" />
      </div>
    </div>
  );
}
