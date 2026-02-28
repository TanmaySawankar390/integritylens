"use client";

import { API_BASE_URL, apiFetch } from "@/lib/api";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { getAuth } from "@/lib/auth";

type ScriptRow = {
  id: string;
  status: string;
  total_marks_awarded: number | null;
  created_at: string;
};

export default function UploadPage() {
  const params = useParams<{ testId: string }>();
  const testId = params.testId;
  const [questionPaper, setQuestionPaper] = useState<File | null>(null);
  const [uploadingQuestionPaper, setUploadingQuestionPaper] = useState(false);
  const [answerFiles, setAnswerFiles] = useState<File[]>([]);
  const [studentNames, setStudentNames] = useState<string[]>([]);
  const [uploadingAnswers, setUploadingAnswers] = useState(false);
  const [evalType, setEvalType] = useState<"general" | "fill_blanks">("general");
  const [uniformMarksPerQ, setUniformMarksPerQ] = useState<number>(0);
  const [blanksPerQ, setBlanksPerQ] = useState<number>(5);
  const [marksPerBlank, setMarksPerBlank] = useState<number>(1);
  const [totalMarksOverride, setTotalMarksOverride] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [scripts, setScripts] = useState<ScriptRow[]>([]);

  const auth = useMemo(() => getAuth(), []);

  const loadScripts = useCallback(() => {
    apiFetch<{ scripts: ScriptRow[] }>(`/tests/${testId}/scripts`)
      .then((d) => setScripts(d.scripts))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [testId]);

  useEffect(() => {
    loadScripts();
  }, [loadScripts]);

  const onUploadQuestionPaper = async () => {
    setError(null);
    if (!questionPaper) {
      setError("Select a question paper PDF.");
      return;
    }
    setUploadingQuestionPaper(true);
    try {
      const form = new FormData();
      form.append("file", questionPaper);
      form.append("evaluation_type", evalType);
      form.append("uniform_marks_per_question", String(uniformMarksPerQ));
      form.append("blanks_per_question", String(blanksPerQ));
      form.append("marks_per_blank", String(marksPerBlank));
      form.append("total_marks_override", String(totalMarksOverride));
      const res = await fetch(`${API_BASE_URL}/uploads/tests/${testId}/question-paper`, {
        method: "POST",
        headers: {
          Authorization: auth?.token ? `Bearer ${auth.token}` : ""
        },
        body: form
      });
      if (!res.ok) throw new Error(await res.text());
      setQuestionPaper(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingQuestionPaper(false);
    }
  };

  const onUploadAnswersBulk = async () => {
    setError(null);
    if (answerFiles.length === 0) {
      setError("Select at least one answer PDF.");
      return;
    }
    setUploadingAnswers(true);
    try {
      const form = new FormData();
      for (const f of answerFiles) form.append("scripts", f);
      form.append("students", JSON.stringify(studentNames));
      const res = await fetch(`${API_BASE_URL}/uploads/tests/${testId}/scripts/bulk`, {
        method: "POST",
        headers: {
          Authorization: auth?.token ? `Bearer ${auth.token}` : ""
        },
        body: form
      });
      if (!res.ok) throw new Error(await res.text());
      setAnswerFiles([]);
      setStudentNames([]);
      loadScripts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingAnswers(false);
    }
  };

  const canUploadQuestionPaper = Boolean(questionPaper);
  const canUploadAnswers = answerFiles.length > 0;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Upload Question Paper & Answers</h1>
        <div className="flex gap-2">
          <Link
            href={`/tests/${testId}/analytics`}
            className="rounded-md border px-3 py-2 text-sm hover:bg-zinc-50"
          >
            Analytics
          </Link>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-white p-5">
          <div className="text-sm font-medium">Question paper (PDF)</div>
          <div className="text-sm text-zinc-600">Upload the official question paper to auto-extract questions.</div>
          <div className="mt-3 grid gap-3">
            <div>
              <label className="text-sm font-medium">Question type</label>
              <select
                value={evalType}
                onChange={(e) => setEvalType(e.target.value === "fill_blanks" ? "fill_blanks" : "general")}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="general">General</option>
                <option value="fill_blanks">Fill in the blanks</option>
              </select>
            </div>
            {evalType === "general" ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Uniform marks per question</label>
                  <input
                    type="number"
                    value={uniformMarksPerQ}
                    onChange={(e) => setUniformMarksPerQ(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Total marks (override)</label>
                  <input
                    type="number"
                    value={totalMarksOverride}
                    onChange={(e) => setTotalMarksOverride(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-sm font-medium">Blanks per main question</label>
                  <input
                    type="number"
                    value={blanksPerQ}
                    onChange={(e) => setBlanksPerQ(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Marks per blank</label>
                  <input
                    type="number"
                    value={marksPerBlank}
                    onChange={(e) => setMarksPerBlank(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Total marks (override)</label>
                  <input
                    type="number"
                    value={totalMarksOverride}
                    onChange={(e) => setTotalMarksOverride(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>
              </div>
            )}
          </div>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setQuestionPaper((e.target.files && e.target.files[0]) || null)}
            className="mt-3 w-full"
          />
          <button
            disabled={!canUploadQuestionPaper || uploadingQuestionPaper}
            onClick={onUploadQuestionPaper}
            className="mt-3 rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {uploadingQuestionPaper ? "Uploading..." : "Upload question paper"}
          </button>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <div className="text-sm font-medium">Answer copies (PDF)</div>
          <div className="text-sm text-zinc-600">Upload multiple answer sheets. Provide student names for each.</div>
          <input
            type="file"
            multiple
            accept="application/pdf"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              setAnswerFiles(files);
              setStudentNames(files.map((f) => f.name.replace(/\.[^.]+$/, "")));
            }}
            className="mt-3 w-full"
          />
          {answerFiles.length > 0 ? (
            <div className="mt-3 grid gap-2">
              {answerFiles.map((f, idx) => (
                <div key={`${f.name}-${idx}`} className="flex items-center gap-2">
                  <div className="flex-1 truncate text-sm text-zinc-700">{f.name}</div>
                  <input
                    type="text"
                    value={studentNames[idx] ?? ""}
                    onChange={(e) => {
                      const next = [...studentNames];
                      next[idx] = e.target.value;
                      setStudentNames(next);
                    }}
                    placeholder="Student name"
                    className="w-48 rounded-md border px-2 py-1 text-sm"
                  />
                </div>
              ))}
            </div>
          ) : null}
          <button
            disabled={!canUploadAnswers || uploadingAnswers}
            onClick={onUploadAnswersBulk}
            className="mt-3 rounded-md bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {uploadingAnswers ? "Uploading..." : "Upload answer copies"}
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-xl border bg-white p-5">
        <div className="text-sm font-medium">Uploaded scripts</div>
        <div className="mt-3 grid gap-3">
          {scripts.map((s) => (
            <div key={s.id} className="rounded-xl border bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">Script {s.id.slice(0, 8)}…</div>
                  <div className="text-sm text-zinc-600">{s.status}</div>
                </div>
                <div className="text-sm text-zinc-700">
                  {s.total_marks_awarded == null ? "-" : s.total_marks_awarded}
                </div>
                <Link
                  href={`/tests/${testId}/scripts/${s.id}`}
                  className="rounded-md border px-3 py-2 text-sm hover:bg-zinc-50"
                >
                  Review
                </Link>
              </div>
            </div>
          ))}
          {scripts.length === 0 ? (
            <div className="rounded-xl border bg-white p-4 text-sm text-zinc-600">
              No uploads yet.
            </div>
          ) : null}
        </div>
        {error ? (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
