"use client";

import { apiFetch } from "@/lib/api";
import { setAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("teacher@demo.school");
  const [password, setPassword] = useState("Demo@1234");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<{
        token: string;
        teacher: { id: string; displayName: string };
      }>("/auth/login", {
        method: "POST",
        auth: false,
        body: JSON.stringify({ email, password })
      });
      setAuth({ token: data.token, teacher: data.teacher });
      router.replace("/tests");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center">
      <div className="w-full max-w-sm text-center mb-8">
        <h1 className="text-3xl font-serif font-medium text-[var(--brand)]">ShikshaMitra</h1>
        <p className="mt-2 text-[var(--muted)] text-sm">
          Intelligent assessment for modern educators.
        </p>
      </div>

      <div className="w-full max-w-sm">
        <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wider font-semibold text-[var(--muted)]">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)] transition-shadow"
              autoComplete="email"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wider font-semibold text-[var(--muted)]">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)] transition-shadow"
              autoComplete="current-password"
            />
          </div>
          {error ? (
            <div className="rounded-lg border border-[var(--error)]/20 bg-[var(--error-light)] p-3 text-sm text-[var(--error)]">
              {error}
            </div>
          ) : null}
          <button
            disabled={loading}
            className="w-full rounded-lg bg-[var(--brand)] px-4 py-3 font-medium text-[var(--brand-foreground)] hover:bg-[var(--brand-light)] disabled:opacity-60 transition-colors mt-2"
          >
            {loading ? "Authenticating..." : "Sign in to Workspace"}
          </button>
        </form>
      </div>
    </div>
  );
}
