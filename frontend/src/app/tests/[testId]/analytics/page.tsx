"use client";

import { apiFetch } from "@/lib/api";
import Link from "next/link";
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

  useEffect(() => {
    apiFetch<{ per_question: PerQuestion[]; common_mistakes: TagRow[] }>(
      `/analytics/tests/${testId}`
    )
      .then((d) => {
        setPerQ(d.per_question);
        setTags(d.common_mistakes);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [testId]);

  const maxAvg = useMemo(() => Math.max(1, ...perQ.map((p) => p.avg_marks)), [perQ]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <div className="flex gap-2">
          <Link
            href={`/tests/${testId}/upload`}
            className="rounded-md border px-3 py-2 text-sm hover:bg-zinc-50"
          >
            Upload
          </Link>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-5">
          <div className="text-sm font-medium">Average marks per question</div>
          <div className="mt-3 space-y-3">
            {perQ.map((q) => (
              <div key={q.question_id}>
                <div className="flex items-center justify-between text-sm">
                  <div className="truncate pr-3">
                    Q{q.question_no} • {q.graded_count} graded
                  </div>
                  <div className="text-zinc-600">
                    {q.avg_marks.toFixed(2)} / {q.max_marks}
                  </div>
                </div>
                <div className="mt-1 h-2 w-full rounded-full bg-zinc-100">
                  <div
                    className="h-2 rounded-full bg-blue-600"
                    style={{ width: `${Math.min(100, (q.avg_marks / maxAvg) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {perQ.length === 0 ? (
              <div className="text-sm text-zinc-600">No grading data yet.</div>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <div className="text-sm font-medium">Top common mistakes</div>
          <div className="mt-3 space-y-2">
            {tags.slice(0, 10).map((t) => (
              <div key={t.tag} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                <div className="font-medium">{t.tag}</div>
                <div className="text-zinc-600">{t.count}</div>
              </div>
            ))}
            {tags.length === 0 ? (
              <div className="text-sm text-zinc-600">No error tags yet.</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
