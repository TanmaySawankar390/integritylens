"use client";

import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useEffect, useState } from "react";

type TestRow = {
  id: string;
  subject: string;
  class_level: string;
  board: string;
  test_date: string;
  total_marks: number;
};

export default function TestsPage() {
  const [tests, setTests] = useState<TestRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch<{ tests: TestRow[] }>("/tests")
      .then((d) => setTests(d.tests))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-end justify-between border-b border-[var(--border)] pb-6 mb-8">
        <div>
          <h1 className="text-3xl font-serif text-[var(--brand)]">Assessments</h1>
          <p className="text-[var(--muted)] mt-1">Manage your examination batches and student scripts.</p>
        </div>
        <Link
          href="/tests/new"
          className="rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-medium text-[var(--brand-foreground)] hover:bg-[var(--brand-light)] transition-colors shadow-sm"
        >
          Create New Assessment
        </Link>
      </div>

      {error ? (
        <div className="mb-6 rounded-lg border border-[var(--error)]/20 bg-[var(--error-light)] p-4 text-sm text-[var(--error)]">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4">
        {loading ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--muted)]">
            Loading assessments...
          </div>
        ) : tests.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-12 text-center">
            <h3 className="text-lg font-serif text-[var(--foreground)] mb-2">No assessments found</h3>
            <p className="text-[var(--muted)]">Create your first assessment to begin configuring questions.</p>
          </div>
        ) : (
          tests.map((t) => (
            <div key={t.id} className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 transition-all hover:shadow-md hover:border-[var(--brand-light)]">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-xs uppercase tracking-wider font-semibold text-[var(--accent)] bg-[var(--accent-light)] px-2 py-0.5 rounded">
                      {t.board} CL{t.class_level}
                    </span>
                    <span className="text-sm text-[var(--muted)]">{t.test_date}</span>
                  </div>
                  <h3 className="text-xl font-medium text-[var(--foreground)]">
                    {t.subject}
                  </h3>
                  <div className="text-sm text-[var(--muted)] mt-1">
                    Total Marks: {t.total_marks}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/tests/${t.id}/questions`}
                    className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm text-[var(--brand)] font-medium hover:border-[var(--brand)] hover:bg-[var(--brand)] hover:text-[var(--brand-foreground)] transition-all"
                  >
                    Questions
                  </Link>
                  <Link
                    href={`/tests/${t.id}/upload`}
                    className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm text-[var(--brand)] font-medium hover:border-[var(--brand)] hover:bg-[var(--brand)] hover:text-[var(--brand-foreground)] transition-all"
                  >
                    Upload Scripts
                  </Link>
                  <Link
                    href={`/tests/${t.id}/analytics`}
                    className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm text-[var(--brand)] font-medium hover:border-[var(--brand)] hover:bg-[var(--brand)] hover:text-[var(--brand-foreground)] transition-all"
                  >
                    Analytics
                  </Link>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
