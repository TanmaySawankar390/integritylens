"use client";

import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type QuestionRow = {
  id: string;
  question_no: number;
  question_text: string;
  max_marks: number;
  solution_outline: string;
  marking_rubric_json: unknown;
};

export default function QuestionsPage() {
  const params = useParams<{ testId: string }>();
  const testId = params.testId;

  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(true);

  const [questionNo, setQuestionNo] = useState(1);
  const [questionText, setQuestionText] = useState("");
  const [maxMarks, setMaxMarks] = useState(4);
  const [solutionOutline, setSolutionOutline] = useState("");
  const [rubricJson, setRubricJson] = useState(
    JSON.stringify(
      {
        steps: [
          { step: 1, criteria: "Correct method/formula", marks: 1 },
          { step: 2, criteria: "Correct substitution", marks: 1 },
          { step: 3, criteria: "Correct calculation", marks: 1 },
          { step: 4, criteria: "Final answer + units", marks: 1 }
        ],
        tags: ["concept_error", "calculation_error", "missing_steps", "final_answer_wrong"]
      },
      null,
      2
    )
  );

  const load = useCallback(() => {
    apiFetch<{ questions: QuestionRow[] }>(`/tests/${testId}/questions`)
      .then((d) => setQuestions(d.questions))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoadingQuestions(false));
  }, [testId]);

  useEffect(() => {
    load();
  }, [load]);

  const nextNo = useMemo(() => {
    const max = questions.reduce((m, q) => Math.max(m, q.question_no), 0);
    return max + 1;
  }, [questions]);

  useEffect(() => {
    setQuestionNo(nextNo);
  }, [nextNo]);

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const parsed = JSON.parse(rubricJson);
      await apiFetch(`/tests/${testId}/questions`, {
        method: "POST",
        body: JSON.stringify({
          question_no: questionNo,
          question_text: questionText,
          max_marks: maxMarks,
          solution_outline: solutionOutline,
          marking_rubric_json: parsed
        })
      });
      setQuestionText("");
      setSolutionOutline("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Add failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-end justify-between border-b border-[var(--border)] pb-6 mb-8">
        <div>
          <h1 className="text-3xl font-serif text-[var(--brand)]">Curriculum Config</h1>
          <p className="text-[var(--muted)] mt-1">Configure questions and grading rubrics for this assessment.</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/tests"
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--background)] transition-colors"
          >
            ← Back to Assessments
          </Link>
          <Link
            href={`/tests/${testId}/upload`}
            className="rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-medium text-[var(--brand-foreground)] hover:bg-[var(--brand-light)] transition-colors shadow-sm"
          >
            Upload Scripts
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_400px] gap-8">
        <div className="space-y-4">
          <h2 className="text-xl font-serif text-[var(--foreground)] mb-4">Question Bank</h2>
          {loadingQuestions ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--muted)]">
              Loading questions...
            </div>
          ) : questions.length === 0 ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-12 text-center border-dashed">
              <h3 className="text-lg font-serif text-[var(--foreground)] mb-2">Workspace empty</h3>
              <p className="text-[var(--muted)]">Add questions manually via the form, or automatically extract them from a test paper PDF on the Upload page.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((q) => (
                <div key={q.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[var(--accent-light)] flex items-center justify-center text-[var(--accent)] font-serif text-lg">
                      Q{q.question_no}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-[var(--muted)] uppercase tracking-wider">
                          {q.max_marks} Marks
                        </span>
                      </div>
                      <p className="text-[var(--foreground)] whitespace-pre-wrap leading-relaxed">
                        {q.question_text}
                      </p>
                      {q.solution_outline && (
                        <div className="mt-4 p-4 rounded-xl bg-[var(--background)] text-sm">
                          <strong className="text-[var(--brand)] font-medium">Expected Outline:</strong>
                          <p className="text-[var(--muted)] mt-1 whitespace-pre-wrap">{q.solution_outline}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-24 h-fit">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
            <h2 className="text-xl font-serif text-[var(--brand)] mb-6">Append Item</h2>
            <form onSubmit={onAdd} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs uppercase tracking-wider font-semibold text-[var(--muted)]">Question No.</label>
                  <input
                    type="number"
                    value={questionNo}
                    onChange={(e) => setQuestionNo(Number(e.target.value))}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)] transition-shadow"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs uppercase tracking-wider font-semibold text-[var(--muted)]">Max Marks</label>
                  <input
                    type="number"
                    value={maxMarks}
                    onChange={(e) => setMaxMarks(Number(e.target.value))}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)] transition-shadow"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-wider font-semibold text-[var(--muted)]">Prompt Content</label>
                <textarea
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)] transition-shadow resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-wider font-semibold text-[var(--muted)]">Solution Guide</label>
                <textarea
                  value={solutionOutline}
                  onChange={(e) => setSolutionOutline(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)] transition-shadow resize-none"
                  placeholder="Optional pointer for AI..."
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-wider font-semibold text-[var(--muted)]">Grading Rubric (JSON)</label>
                <textarea
                  value={rubricJson}
                  onChange={(e) => setRubricJson(e.target.value)}
                  rows={8}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3 font-mono text-[11px] text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)] transition-shadow"
                />
              </div>
              {error ? (
                <div className="rounded-lg border border-[var(--error)]/20 bg-[var(--error-light)] p-3 text-sm text-[var(--error)]">
                  {error}
                </div>
              ) : null}
              <button
                disabled={loading}
                className="w-full rounded-xl bg-[var(--brand)] px-4 py-3 font-medium text-[var(--brand-foreground)] hover:bg-[var(--brand-light)] disabled:opacity-60 transition-colors"
              >
                {loading ? "Processing..." : "Append to Workspace"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
