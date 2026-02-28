"use client";

import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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

  const load = useCallback(async () => {
    const data = await apiFetch<{
      script: { status: string; total_marks_awarded: number | null };
      pages: PageRow[];
      question_answers: QA[];
    }>(`/tests/${testId}/scripts/${scriptId}`);
    setStatus(data.script.status);
    setPages(data.pages);
    setQas(data.question_answers);
    if (selectedQ == null && data.question_answers.length) setSelectedQ(data.question_answers[0].question_no);
  }, [scriptId, selectedQ, testId]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
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

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Review Script</h1>
          <div className="text-sm text-zinc-600">Status: {status}</div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/tests/${testId}/upload`}
            className="rounded-md border px-3 py-2 text-sm hover:bg-zinc-50"
          >
            Back to upload
          </Link>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-3">
          <div className="flex items-center justify-between px-2 py-1">
            <div className="text-sm font-medium">Page</div>
            <div className="flex gap-2">
              {pages.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPage(p.page_no)}
                  className={`rounded-md border px-2 py-1 text-sm ${
                    selectedPage === p.page_no ? "bg-zinc-100" : "hover:bg-zinc-50"
                  }`}
                >
                  {p.page_no}
                </button>
              ))}
            </div>
          </div>
          {currentPageUrl ? (
            <div className="relative w-full overflow-hidden rounded-lg border">
              {pages.find((p) => p.page_no === selectedPage)?.mime_type ===
              "application/pdf" ? (
                <object data={currentPageUrl} type="application/pdf" className="h-[70vh] w-full" />
              ) : (
                <img
                  src={currentPageUrl}
                  alt="Answer page"
                  className="w-full"
                  onLoad={(e) => {
                    const img = e.currentTarget;
                    setImgSize({ w: img.clientWidth, h: img.clientHeight });
                  }}
                />
              )}
              <svg className="pointer-events-none absolute inset-0 h-full w-full">
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
                      fill="rgba(59,130,246,0.15)"
                      stroke="rgba(37,99,235,0.9)"
                      strokeWidth="1"
                    />
                  );
                })}
              </svg>
            </div>
          ) : (
            <div className="p-4 text-sm text-zinc-600">No page available.</div>
          )}
        </div>

        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Questions</div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowHindi(false)}
                className={`rounded-md border px-2 py-1 text-sm ${
                  !showHindi ? "bg-zinc-100" : "hover:bg-zinc-50"
                }`}
              >
                English
              </button>
              <button
                onClick={() => setShowHindi(true)}
                className={`rounded-md border px-2 py-1 text-sm ${
                  showHindi ? "bg-zinc-100" : "hover:bg-zinc-50"
                }`}
              >
                Hindi
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {qas.map((q) => (
              <button
                key={q.id}
                onClick={() => setSelectedQ(q.question_no)}
                className={`rounded-md border px-2 py-1 text-sm ${
                  selectedQ === q.question_no ? "bg-zinc-100" : "hover:bg-zinc-50"
                }`}
              >
                Q{q.question_no}
              </button>
            ))}
          </div>

          {currentQa ? (
            <div className="mt-4 space-y-3">
              <div>
                <div className="text-sm font-medium">Question</div>
                <div className="mt-1 whitespace-pre-wrap text-sm text-zinc-700">
                  {currentQa.question_text}
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border bg-zinc-50 p-3">
                <div className="text-sm">
                  Marks:{" "}
                  <span className="font-semibold">
                    {currentQa.marks_awarded ?? "-"}
                  </span>{" "}
                  / {currentQa.max_marks}
                </div>
                <div className="text-sm text-zinc-600">
                  Confidence:{" "}
                  {currentQa.confidence != null
                    ? `${Math.round(currentQa.confidence * 100)}%`
                    : "-"}
                </div>
              </div>
              {currentQa.needs_manual_review ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  Flagged for manual review.
                </div>
              ) : null}
              <div>
                <div className="text-sm font-medium">Extracted answer</div>
                <div className="mt-1 whitespace-pre-wrap rounded-lg border p-3 text-sm text-zinc-700">
                  {currentQa.answer_text?.trim()
                    ? currentQa.answer_text
                    : "No extracted answer text."}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Feedback</div>
                  {showHindi && !currentQa.feedback_hi ? (
                    <button
                      onClick={onTranslate}
                      className="rounded-md border px-2 py-1 text-sm hover:bg-zinc-50"
                    >
                      Translate
                    </button>
                  ) : null}
                </div>
                <div className="mt-1 whitespace-pre-wrap rounded-lg border p-3 text-sm text-zinc-700">
                  {showHindi
                    ? currentQa.feedback_hi ?? "Hindi translation not available."
                    : currentQa.feedback_en ?? ""}
                </div>
              </div>
              
              <div>
                <div className="text-sm font-medium">Error tags</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(currentQa.error_tags_json ?? []).map((t) => (
                    <span key={t} className="rounded-full border bg-white px-2 py-1 text-xs">
                      {t}
                    </span>
                  ))}
                  {(currentQa.error_tags_json ?? []).length === 0 ? (
                    <div className="text-sm text-zinc-600">None.</div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-zinc-600">No graded answers yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
