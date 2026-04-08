"use client";

import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export default function CreateTestPage() {
  const router = useRouter();
  const [subject, setSubject] = useState<"Mathematics" | "Language">("Mathematics");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<{ id: string }>("/tests", {
        method: "POST",
        body: JSON.stringify({
          subject,
          class_level: "10",
          board: "CBSE",
          test_date: new Date().toISOString().slice(0, 10),
          total_marks: 100
        })
      });
      router.replace(`/tests/${data.id}/upload`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-serif text-[var(--brand)]">Setup Assessment</h1>
        <Link href="/tests" className="text-sm text-[var(--muted)] hover:text-[var(--brand)] transition-colors">
          Cancel
        </Link>
      </div>

      <form onSubmit={onSubmit} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-sm">
        <p className="text-[var(--muted)] mb-6">
          Initialize a new workspace for CBSE Class 10 scripts. More options will be unlocked in later steps.
        </p>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider font-semibold text-[var(--muted)]">Subject Discipline</label>
            <div className="relative">
              <select
                value={subject}
                onChange={(e) =>
                  setSubject(e.target.value === "Language" ? "Language" : "Mathematics")
                }
                className="w-full appearance-none rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)] transition-shadow"
              >
                <option value="Mathematics">Mathematics</option>
                <option value="Language">Language Structure</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-[var(--muted)]">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 opacity-60">
              <label className="text-xs uppercase tracking-wider font-semibold text-[var(--muted)]">Target Level</label>
              <input disabled value="Class 10" className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-[var(--foreground)] cursor-not-allowed" />
            </div>
            <div className="space-y-2 opacity-60">
              <label className="text-xs uppercase tracking-wider font-semibold text-[var(--muted)]">Board Standard</label>
              <input disabled value="CBSE" className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-[var(--foreground)] cursor-not-allowed" />
            </div>
          </div>

          {error ? (
            <div className="rounded-lg border border-[var(--error)]/20 bg-[var(--error-light)] p-4 text-sm text-[var(--error)]">
              {error}
            </div>
          ) : null}

          <div className="pt-4 border-t border-[var(--border)] flex justify-end">
            <button
              disabled={loading}
              className="rounded-full bg-[var(--brand)] px-6 py-2.5 font-medium text-[var(--brand-foreground)] hover:bg-[var(--brand-light)] disabled:opacity-60 transition-colors"
            >
              {loading ? "Initializing..." : "Proceed to Configuration"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
