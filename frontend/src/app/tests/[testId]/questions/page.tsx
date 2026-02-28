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
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
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
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Questions</h1>
        <div className="flex gap-2">
          <Link
            href={`/tests/${testId}/upload`}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Upload answers
          </Link>
          <Link
            href="/tests"
            className="rounded-md border px-3 py-2 text-sm hover:bg-zinc-50"
          >
            Back
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {questions.map((q) => (
          <div key={q.id} className="rounded-xl border bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">
                  Q{q.question_no} • {q.max_marks} marks
                </div>
                <div className="mt-1 whitespace-pre-wrap text-sm text-zinc-700">
                  {q.question_text}
                </div>
              </div>
            </div>
          </div>
        ))}
        {questions.length === 0 ? (
          <div className="rounded-xl border bg-white p-4 text-sm text-zinc-600">
            No questions yet. Add at least 1 question to grade answers.
          </div>
        ) : null}
      </div>

      <div className="mt-6 rounded-xl border bg-white p-5">
        <h2 className="text-lg font-semibold">Add question</h2>
        <form onSubmit={onAdd} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Question number</label>
              <input
                type="number"
                value={questionNo}
                onChange={(e) => setQuestionNo(Number(e.target.value))}
                className="mt-1 w-full rounded-md border px-3 py-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Max marks</label>
              <input
                type="number"
                value={maxMarks}
                onChange={(e) => setMaxMarks(Number(e.target.value))}
                className="mt-1 w-full rounded-md border px-3 py-2"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Question text</label>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border px-3 py-2"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Solution outline</label>
            <textarea
              value={solutionOutline}
              onChange={(e) => setSolutionOutline(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border px-3 py-2"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Marking rubric (JSON)</label>
            <textarea
              value={rubricJson}
              onChange={(e) => setRubricJson(e.target.value)}
              rows={10}
              className="mt-1 w-full rounded-md border px-3 py-2 font-mono text-xs"
            />
          </div>
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          <button
            disabled={loading}
            className="rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {loading ? "Adding..." : "Add question"}
          </button>
        </form>
      </div>
    </div>
  );
}
