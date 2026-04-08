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
  student_name: string | null;
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
  const [success, setSuccess] = useState<string | null>(null);
  const [scripts, setScripts] = useState<ScriptRow[]>([]);
  const [loadingScripts, setLoadingScripts] = useState(true);

  const auth = useMemo(() => getAuth(), []);

  const loadScripts = useCallback(() => {
    apiFetch<{ scripts: ScriptRow[] }>(`/tests/${testId}/scripts`)
      .then((d) => setScripts(d.scripts))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoadingScripts(false));
  }, [testId]);

  useEffect(() => {
    loadScripts();
  }, [loadScripts]);

  const onUploadQuestionPaper = async () => {
    // ... logic remains same ...
    setError(null);
    setSuccess(null);
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
      setSuccess("Question paper processed. Rubrics updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingQuestionPaper(false);
    }
  };

  const onUploadAnswersBulk = async () => {
    // ... logic remains same ...
    setError(null);
    setSuccess(null);
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
      setSuccess(`${answerFiles.length} script(s) dispatched for grading.`);
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
    <div className="max-w-6xl mx-auto">
      <div className="flex items-end justify-between border-b border-[var(--border)] pb-6 mb-8">
        <div>
          <h1 className="text-3xl font-serif text-[var(--brand)]">Resource Ingestion</h1>
          <p className="text-[var(--muted)] mt-1">Provide question papers to extract rubrics, or process student scripts.</p>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/tests/${testId}/questions`}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--background)] transition-colors"
          >
            Review Rubrics
          </Link>
          <Link
            href={`/tests/${testId}/analytics`}
            className="rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-medium text-[var(--brand-foreground)] hover:bg-[var(--brand-light)] transition-colors shadow-sm"
          >
            View Analytics
          </Link>
        </div>
      </div>

      {error ? (
        <div className="mb-6 rounded-lg border border-[var(--error)]/20 bg-[var(--error-light)] p-4 text-sm text-[var(--error)]">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mb-6 rounded-lg border border-[var(--success)]/20 bg-[var(--success-light)] p-4 text-sm text-[var(--success)]">
          {success}
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <h3 className="text-lg font-serif text-[var(--foreground)]">Reference Paper Extraction</h3>
          <p className="text-sm text-[var(--muted)] mt-1 mb-6">Upload the official paper PDF to construct questions automatically.</p>
          
          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider font-semibold text-[var(--muted)]">Exam Taxonomy</label>
              <select
                value={evalType}
                onChange={(e) => setEvalType(e.target.value === "fill_blanks" ? "fill_blanks" : "general")}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
              >
                <option value="general">Standard Explanatory</option>
                <option value="fill_blanks">Fill in the Blanks</option>
              </select>
            </div>

            {evalType === "general" ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs uppercase tracking-wider font-semibold text-[var(--muted)]">Uniform Marks</label>
                  <input
                    type="number"
                    value={uniformMarksPerQ}
                    onChange={(e) => setUniformMarksPerQ(Number(e.target.value))}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs uppercase tracking-wider font-semibold text-[var(--muted)]">Total Limit</label>
                  <input
                    type="number"
                    value={totalMarksOverride}
                    onChange={(e) => setTotalMarksOverride(Number(e.target.value))}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs uppercase tracking-wider font-semibold text-[var(--muted)]">Blanks/Q</label>
                  <input
                    type="number"
                    value={blanksPerQ}
                    onChange={(e) => setBlanksPerQ(Number(e.target.value))}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs uppercase tracking-wider font-semibold text-[var(--muted)]">Marks/Blank</label>
                  <input
                    type="number"
                    value={marksPerBlank}
                    onChange={(e) => setMarksPerBlank(Number(e.target.value))}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs uppercase tracking-wider font-semibold text-[var(--muted)]">Total Limit</label>
                  <input
                    type="number"
                    value={totalMarksOverride}
                    onChange={(e) => setTotalMarksOverride(Number(e.target.value))}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--brand)]"
                  />
                </div>
              </div>
            )}

            <div className="pt-2">
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setQuestionPaper((e.target.files && e.target.files[0]) || null)}
                className="w-full text-sm text-[var(--muted)] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[var(--brand)] file:text-white hover:file:bg-[var(--brand-light)]"
              />
            </div>
            
            <button
              disabled={!canUploadQuestionPaper || uploadingQuestionPaper}
              onClick={onUploadQuestionPaper}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-3 font-medium text-[var(--brand)] hover:border-[var(--brand)] transition-colors disabled:opacity-50"
            >
              {uploadingQuestionPaper ? "Analyzing PDF..." : "Extract Configuration"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <h3 className="text-lg font-serif text-[var(--foreground)]">Student Scripts</h3>
          <p className="text-sm text-[var(--muted)] mt-1 mb-6">Upload scanned scripts in PDF format for automated grading.</p>
          
          <div className="space-y-5">
            <input
              type="file"
              multiple
              accept="application/pdf"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                setAnswerFiles(files);
                setStudentNames(files.map((f) => f.name.replace(/\.[^.]+$/, "")));
              }}
              className="w-full text-sm text-[var(--muted)] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[var(--brand)] file:text-white hover:file:bg-[var(--brand-light)]"
            />
            {answerFiles.length > 0 ? (
              <div className="max-h-48 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
                {answerFiles.map((f, idx) => (
                  <div key={`${f.name}-${idx}`} className="flex items-center gap-3">
                    <div className="flex-1 truncate text-sm text-[var(--muted)] font-mono text-xs">{f.name}</div>
                    <input
                      type="text"
                      value={studentNames[idx] ?? ""}
                      onChange={(e) => {
                        const next = [...studentNames];
                        next[idx] = e.target.value;
                        setStudentNames(next);
                      }}
                      placeholder="Student Scholar ID"
                      className="w-48 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--brand)]"
                    />
                  </div>
                ))}
              </div>
            ) : null}
            <button
              disabled={!canUploadAnswers || uploadingAnswers}
              onClick={onUploadAnswersBulk}
              className="w-full rounded-xl bg-[var(--brand)] px-4 py-3 font-medium text-[var(--brand-foreground)] hover:bg-[var(--brand-light)] disabled:opacity-60 transition-colors mt-2"
            >
              {uploadingAnswers ? "Transferring..." : "Commence AI Grading"}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <h3 className="text-lg font-serif text-[var(--brand)] mb-6">Processing Queue</h3>
        <div className="grid gap-3">
          {loadingScripts ? (
            <div className="p-8 text-center text-sm text-[var(--muted)]">
              Fetching pipeline status...
            </div>
          ) : scripts.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--muted)] border border-dashed border-[var(--border)] rounded-xl">
              Queue is empty. Awaiting submissions.
            </div>
          ) : (
            scripts.map((s) => (
              <div key={s.id} className="group rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-4 flex items-center justify-between hover:border-[var(--brand-light)] transition-colors">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${s.status === 'graded' ? 'bg-[var(--success)]' : s.status === 'error' ? 'bg-[var(--error)]' : 'bg-[var(--accent)] animate-pulse'}`}></div>
                    <div>
                      <div className="font-medium text-[var(--foreground)]">
                        {s.student_name ? s.student_name : `Candidate ${s.id.slice(0, 6)}`}
                      </div>
                      <div className="text-xs uppercase tracking-wider text-[var(--muted)] mt-0.5">{s.status}</div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-[var(--foreground)] font-serif text-lg leading-none">
                      {s.total_marks_awarded == null ? "—" : s.total_marks_awarded}
                    </div>
                    <div className="text-[10px] uppercase text-[var(--muted)] mt-1">Awarded</div>
                  </div>
                  <Link
                    href={`/tests/${testId}/scripts/${s.id}`}
                    className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--brand)] hover:text-white hover:border-[var(--brand)] transition-all"
                  >
                    Audit
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
