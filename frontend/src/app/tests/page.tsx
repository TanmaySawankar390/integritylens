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

  useEffect(() => {
    apiFetch<{ tests: TestRow[] }>("/tests")
      .then((d) => setTests(d.tests))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">Tests</h1>
        <Link
          href="/tests/new"
          className="rounded-md bg-[var(--brand)] px-3 py-2 text-sm font-medium text-[var(--brand-foreground)] hover:brightness-110"
        >
          Create test
        </Link>
      </div>

      {error ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3">
        {tests.map((t) => (
          <div key={t.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">
                  {t.board} Class {t.class_level} • {t.subject}
                </div>
                <div className="text-sm text-[var(--muted)]">
                  {t.test_date} • Total {t.total_marks}
                </div>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/tests/${t.id}/upload`}
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--background)]"
                >
                  Upload
                </Link>
                <Link
                  href={`/tests/${t.id}/analytics`}
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--background)]"
                >
                  Analytics
                </Link>
              </div>
            </div>
          </div>
        ))}
        {tests.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
            No tests yet. Create one to start.
          </div>
        ) : null}
      </div>
    </div>
  );
}
