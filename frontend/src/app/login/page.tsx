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
      router.replace("/tests/new");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-semibold text-[var(--foreground)]">Teacher Login</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Sign in to create tests, upload answer sheets, and review AI grading.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
        <div>
          <label className="text-sm font-medium">Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
            autoComplete="email"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-[var(--border)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
            autoComplete="current-password"
          />
        </div>
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        <button
          disabled={loading}
          className="w-full rounded-md bg-[var(--brand)] px-4 py-2 font-medium text-[var(--brand-foreground)] hover:brightness-110 disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
