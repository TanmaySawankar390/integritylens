"use client";

import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type PerQuestion = {
  question_id: string;
  question_no: number;
  question_text: string;
  max_marks: number;
  avg_marks: number;
  graded_count: number;
};

type TagRow = { tag: string; count: number };

export default function AnalyticsPage() {
  const params = useParams<{ testId: string }>();
  const testId = params.testId;
  const [perQ, setPerQ] = useState<PerQuestion[]>([]);
  const [tags, setTags] = useState<TagRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch<{ per_question: PerQuestion[]; common_mistakes: TagRow[] }>(
      `/analytics/tests/${testId}`
    )
      .then((d) => {
        setPerQ(d.per_question);
        setTags(d.common_mistakes);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [testId]);

  const maxAvg = useMemo(() => Math.max(1, ...perQ.map((p) => p.avg_marks)), [perQ]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-[var(--brand)] font-serif text-lg tracking-wider animate-pulse">
          Synthesizing Data...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-end justify-between border-b border-[var(--border)] pb-6 mb-8">
        <div>
          <h1 className="text-3xl font-serif text-[var(--brand)]">Performance Diagnostics</h1>
          <p className="text-[var(--muted)] mt-1">Cohort-level insights extrapolated from AI grading models.</p>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/tests/${testId}/questions`}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--background)] transition-colors"
          >
            Review Rubrics
          </Link>
          <Link
            href={`/tests/${testId}/upload`}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--background)] transition-colors"
          >
            Upload Center
          </Link>
        </div>
      </div>

      {error ? (
        <div className="mb-6 rounded-lg border border-[var(--error)]/20 bg-[var(--error-light)] p-4 text-sm text-[var(--error)]">
          {error}
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <h2 className="text-xl font-serif text-[var(--foreground)] mb-6">Aggregate Trajectory</h2>
          <div className="space-y-6">
            {perQ.map((q) => (
              <div key={q.question_id} className="group">
                <div className="flex items-end justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-serif text-lg text-[var(--brand)]">Q{q.question_no}</span>
                    <span className="text-[10px] uppercase tracking-widest text-[var(--muted)] bg-[var(--background)] px-2 py-0.5 rounded">
                      n={q.graded_count}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-medium text-[var(--foreground)]">{q.avg_marks.toFixed(1)}</span>
                    <span className="text-[var(--muted)] text-sm ml-1">/ {q.max_marks}</span>
                  </div>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[var(--background)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--accent)] transition-all duration-1000 ease-out"
                    style={{ width: `${Math.min(100, (q.avg_marks / maxAvg) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {perQ.length === 0 ? (
              <div className="text-center text-[var(--muted)] py-8 border border-dashed border-[var(--border)] rounded-xl">
                Awaiting sufficient pipeline throughput to render trajectory.
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <h2 className="text-xl font-serif text-[var(--foreground)] mb-6">Cognitive Antipatterns</h2>
          <div className="space-y-3">
            {tags.slice(0, 10).map((t, idx) => (
              <div key={t.tag} className="flex items-center p-4 rounded-xl border border-[var(--border)] bg-[var(--background)] hover:border-[var(--brand-light)] transition-colors">
                <div className="w-8 text-center text-[var(--muted)] font-serif italic text-sm">
                  {idx + 1}
                </div>
                <div className="flex-1 font-medium text-[var(--foreground)] pl-3 border-l border-[var(--border)] ml-1">
                  {t.tag.replace(/_/g, ' ')}
                </div>
                <div className="bg-[var(--accent-light)] text-[var(--accent)] text-xs font-semibold px-3 py-1 rounded-full">
                  {t.count} instances
                </div>
              </div>
            ))}
            {tags.length === 0 ? (
              <div className="text-center text-[var(--muted)] py-8 border border-dashed border-[var(--border)] rounded-xl">
                No prevailing anomalies detected across the cohort.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
