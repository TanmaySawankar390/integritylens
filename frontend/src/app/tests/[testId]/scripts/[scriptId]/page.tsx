"use client";

import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";

type PageRow = {
  id: string;
  page_no: number;
  blob_url: string;
  mime_type: string;
  ocr_result_url: string | null;
};

type Step = { step: number; correct: boolean; marks: number; comment: string };

type LineBox = {
  text: string;
  page: number;
  polygon?: number[];
  pageWidth?: number;
  pageHeight?: number;
  unit?: string;
};

type QA = {
  id: string;
  question_id: string;
  question_no: number;
  question_text: string;
  max_marks: number;
  answer_text: string | null;
  answer_bounding_boxes_json: LineBox[] | null;
  marks_awarded: number | null;
  confidence: number | null;
  steps_json: Step[] | null;
  feedback_en: string | null;
  feedback_hi: string | null;
  error_tags_json: string[] | null;
  needs_manual_review: boolean | null;
};

export default function ReviewScriptPage() {
  const params = useParams<{ testId: string; scriptId: string }>();
  const testId = params.testId;
  const scriptId = params.scriptId;

  const [status, setStatus] = useState<string>("loading");
  const [pages, setPages] = useState<PageRow[]>([]);
  const [qas, setQas] = useState<QA[]>([]);
  const [selectedQ, setSelectedQ] = useState<number | null>(null);
  const [selectedPage, setSelectedPage] = useState<number>(1);
  const [imgSize, setImgSize] = useState<{ w: number; h: number }>({ w: 1, h: 1 });
  const [showHindi, setShowHindi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const selectedQRef = useRef(selectedQ);
  selectedQRef.current = selectedQ;

  const load = useCallback(async () => {
    const data = await apiFetch<{
      script: { status: string; total_marks_awarded: number | null };
      pages: PageRow[];
      question_answers: QA[];
    }>(`/tests/${testId}/scripts/${scriptId}`);
    setStatus(data.script.status);
    setPages(data.pages);
    setQas(data.question_answers);
    if (selectedQRef.current == null && data.question_answers.length) {
      setSelectedQ(data.question_answers[0].question_no);
    }
  }, [scriptId, testId]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
    const t = setInterval(() => {
      load().catch(() => undefined);
    }, 4000);
    return () => clearInterval(t);
  }, [load]);

  const currentPageUrl = useMemo(() => {
    return pages.find((p) => p.page_no === selectedPage)?.blob_url ?? pages[0]?.blob_url ?? "";
  }, [pages, selectedPage]);

  const currentQa = useMemo(
    () => qas.find((q) => q.question_no === selectedQ) ?? null,
    [qas, selectedQ]
  );

  const boxes = useMemo(() => {
    const raw = currentQa?.answer_bounding_boxes_json ?? [];
    return raw.filter((b) => Number(b.page) === selectedPage && Array.isArray(b.polygon));
  }, [currentQa, selectedPage]);

  const onTranslate = async () => {
    setError(null);
    try {
      if (!currentQa?.feedback_en) return;
      const data = await apiFetch<{ text: string }>("/translate", {
        method: "POST",
        body: JSON.stringify({ text: currentQa.feedback_en, from: "en", to: "hi" })
      });
      setQas((prev) =>
        prev.map((q) => (q.id === currentQa.id ? { ...q, feedback_hi: data.text } : q))
      );
      setShowHindi(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Translate failed");
    }
  };

  const pageMeta = boxes.find((b) => b.pageWidth && b.pageHeight);
  const pageWidth = Number(pageMeta?.pageWidth ?? imgSize.w);
  const pageHeight = Number(pageMeta?.pageHeight ?? imgSize.h);
  const scaleX = imgSize.w / pageWidth;
  const scaleY = imgSize.h / pageHeight;

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-[var(--brand)] font-serif text-lg tracking-wider animate-pulse">
          Retrieving Manuscript...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto pb-10">
      <div className="flex items-end justify-between border-b border-[var(--border)] pb-6 mb-8">
        <div>
          <h1 className="text-3xl font-serif text-[var(--brand)]">Manuscript Audit</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wider
              ${status === 'graded' ? 'bg-[var(--success-light)] text-[var(--success)]' : 
                status === 'error' ? 'bg-[var(--error-light)] text-[var(--error)]' : 
                'bg-[var(--accent-light)] text-[var(--accent)] animate-pulse'}`}>
              Pipeline: {status}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/tests/${testId}/upload`}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-5 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--background)] transition-colors"
          >
            ← Back to Queue
          </Link>
        </div>
      </div>

      {error ? (
        <div className="mb-6 rounded-lg border border-[var(--error)]/20 bg-[var(--error-light)] p-4 text-sm text-[var(--error)]">
          {error}
        </div>
      ) : null}

      <div className="grid lg:grid-cols-[1fr_450px] xl:grid-cols-[1fr_500px] gap-8 h-[calc(100vh-250px)] min-h-[600px]">
        {/* Left: Document View */}
        <div className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--background)]/50 flex justify-between items-center">
            <span className="text-sm font-medium text-[var(--muted)] uppercase tracking-wider">Source Document</span>
            <div className="flex bg-[var(--surface)] border border-[var(--border)] rounded-lg p-1">
              {pages.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPage(p.page_no)}
                  className={`px-3 py-1 text-sm rounded-md transition-all ${
                    selectedPage === p.page_no 
                      ? "bg-[var(--brand)] text-[var(--brand-foreground)] shadow-sm" 
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  P{p.page_no}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-auto bg-[var(--background)] relative w-full flex items-center justify-center p-4">
            {currentPageUrl ? (
              <div className="relative w-full max-w-4xl shadow-lg border border-[var(--border)] bg-white">
                {pages.find((p) => p.page_no === selectedPage)?.mime_type === "application/pdf" ? (
                  <object data={currentPageUrl} type="application/pdf" className="w-full h-[800px]" />
                ) : (
                  <img
                    src={currentPageUrl}
                    alt="Answer page"
                    className="w-full h-auto block"
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      setImgSize({ w: img.clientWidth, h: img.clientHeight });
                    }}
                  />
                )}
                <svg className="pointer-events-none absolute inset-0 w-full h-full">
                  {boxes.map((b, idx: number) => {
                    const poly: number[] = b.polygon ?? [];
                    if (poly.length < 8) return null;
                    const xs = [poly[0], poly[2], poly[4], poly[6]];
                    const ys = [poly[1], poly[3], poly[5], poly[7]];
                    const minX = Math.min(...xs) * scaleX;
                    const minY = Math.min(...ys) * scaleY;
                    const maxX = Math.max(...xs) * scaleX;
                    const maxY = Math.max(...ys) * scaleY;
                    return (
                      <rect
                        key={idx}
                        x={minX}
                        y={minY}
                        width={Math.max(1, maxX - minX)}
                        height={Math.max(1, maxY - minY)}
                        fill="rgba(212,151,46,0.15)"
                        stroke="rgba(212,151,46,0.8)"
                        strokeWidth="2"
                        rx="2"
                      />
                    );
                  })}
                </svg>
              </div>
            ) : (
              <div className="text-sm text-[var(--muted)]">Document unavailable</div>
            )}
          </div>
        </div>

        {/* Right: Analysis Panel */}
        <div className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--background)]/50 flex justify-between items-center shrink-0">
            <span className="text-sm font-medium text-[var(--muted)] uppercase tracking-wider">Evaluation</span>
            <div className="flex bg-[var(--surface)] border border-[var(--border)] rounded-lg p-1">
              <button
                onClick={() => setShowHindi(false)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  !showHindi ? "bg-[var(--accent)] text-white shadow-sm" : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setShowHindi(true)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  showHindi ? "bg-[var(--accent)] text-white shadow-sm" : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                HI
              </button>
            </div>
          </div>

          <div className="p-4 border-b border-[var(--border)] overflow-x-auto whitespace-nowrap scrollbar-thin shrink-0">
            <div className="flex gap-2">
              {qas.map((q) => (
                <button
                  key={q.id}
                  onClick={() => setSelectedQ(q.question_no)}
                  className={`flex-shrink-0 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                    selectedQ === q.question_no 
                      ? "bg-[var(--brand)] border-[var(--brand)] text-white shadow-sm" 
                      : "bg-[var(--surface)] border-[var(--border)] text-[var(--muted)] hover:border-[var(--brand-light)] hover:text-[var(--foreground)]"
                  }`}
                >
                  Q{q.question_no}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
            {currentQa ? (
              <div className="space-y-8 pb-8">
                {/* Score Section */}
                <div className="flex items-center justify-between rounded-2xl bg-[var(--background)] p-5 border border-[var(--border)]">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-[var(--muted)] mb-1">Awarded Score</div>
                    <div className="font-serif text-3xl text-[var(--foreground)]">
                      {currentQa.marks_awarded ?? "—"}<span className="text-lg text-[var(--muted)]"> /{currentQa.max_marks}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs uppercase tracking-widest text-[var(--muted)] mb-1">Confidence</div>
                    <div className="text-lg font-medium text-[var(--brand)]">
                      {currentQa.confidence != null ? `${Math.round(currentQa.confidence * 100)}%` : "—"}
                    </div>
                  </div>
                </div>

                {currentQa.needs_manual_review ? (
                  <div className="flex gap-3 rounded-xl border border-[var(--warning)]/30 bg-[var(--warning-light)] p-4 text-[var(--warning)]">
                    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-sm font-medium">Flagged for manual audit by AI system.</span>
                  </div>
                ) : null}

                {/* Question */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">Prompt</h4>
                  <p className="text-[var(--foreground)] leading-relaxed italic border-l-2 border-[var(--brand-light)] pl-4">
                    {currentQa.question_text}
                  </p>
                </div>

                {/* Answer via OCR */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-2">Transcribed Submission</h4>
                  <div className="rounded-xl bg-[var(--background)] border border-[var(--border)] p-4">
                    <p className="text-[var(--foreground)] text-sm leading-relaxed whitespace-pre-wrap font-mono">
                      {currentQa.answer_text?.trim() ? currentQa.answer_text : "No legible submission detected."}
                    </p>
                  </div>
                </div>

                {/* Feedback */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">Diagnostic Feedback</h4>
                    {showHindi && !currentQa.feedback_hi ? (
                      <button
                        onClick={onTranslate}
                        className="text-xs text-[var(--brand)] hover:underline"
                      >
                        Generate Translation
                      </button>
                    ) : null}
                  </div>
                  <div className="rounded-xl border border-[var(--border)] p-4 bg-[var(--surface)] text-sm leading-relaxed text-[var(--foreground)] whitespace-pre-wrap shadow-sm">
                    {showHindi
                      ? currentQa.feedback_hi ?? "Syntax translation unavailable."
                      : currentQa.feedback_en ?? ""}
                  </div>
                </div>
                
                {/* Tags */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] mb-3">Identified Characteristics</h4>
                  <div className="flex flex-wrap gap-2">
                    {(currentQa.error_tags_json ?? []).map((t) => (
                      <span key={t} className="rounded-full bg-[var(--accent-light)] text-[var(--accent)] px-3 py-1 text-xs font-medium">
                        {t.replace(/_/g, ' ')}
                      </span>
                    ))}
                    {(currentQa.error_tags_json ?? []).length === 0 ? (
                      <span className="text-sm italic text-[var(--muted)]">Nominal compliance. No flags.</span>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
                Select an item from the ribbon to view evaluation.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
