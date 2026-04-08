import OpenAI from "openai";
import { env } from "../config/env";
import { extractJsonObject } from "./openai";
import { azureOpenAI, gradingModel } from "./openai";

export type GradePayload = {
  subject?: string;
  questionText: string;
  solutionOutline: string;
  rubric: unknown;
  studentAnswer: string;
  maxMarks: number;
};

export type GradeStep = {
  step: number;
  correct: boolean;
  marks: number;
  comment: string;
};

export type GradeResult = {
  marks_awarded: number;
  max_marks: number;
  confidence: number;
  steps: GradeStep[];
  feedback_en: string;
  ideal_answer_en: string;
  reconstructed_answer_en: string;
  error_tags: string[];
  needs_manual_review: boolean;
};

const systemMessage = [
  "You are an experienced CBSE Class 10 board-exam evaluator.",
  "You specialize in grading HANDWRITTEN student answers extracted via OCR.",
  "OCR text may contain missing symbols, incorrect spacing, minor character errors, and misplaced line breaks.",
  "First reconstruct the most likely intended student answer from the OCR text.",
  "Then evaluate it holistically like a human teacher (no rigid parameter-wise breakdown).",
  "Provide fair, humanized feedback explaining strengths, mistakes, and how to improve.",
  "Be conservative: if a part is unclear or ambiguous due to OCR, lower confidence or set needs_manual_review=true.",
  "Rules: Do NOT invent content not present in the student answer. Penalize calculation mistakes but reward correct method and understanding.",
  "Return ONLY valid JSON using the keys: marks_awarded, max_marks, confidence, steps[], feedback_en, ideal_answer_en, reconstructed_answer_en, error_tags[], needs_manual_review.",
  "No extra text outside JSON."
].join("\n");

const boardRules = [
  "Do not use or infer student identity (name, gender, school).",
  "If OCR text is unclear or incomplete, set needs_manual_review=true and lower confidence.",
  "Return JSON only in the required format.",
  "Adapt evaluation to the subject and the question type:",
  "- Mathematics/Numerical: evaluate understanding and correctness of reasoning and final answer; do not require rigid step allocation.",
  "- Science/Language/Descriptive: evaluate presence of key points/facts, clarity, and correctness; do not require formulas when unnecessary.",
  "- Listings/Enumerations: evaluate number and correctness of listed items.",
  "- Short factual answers: evaluate correctness and brief justification.",
  "If OCR introduces minor symbol/variable confusion (e.g., x misread as n, × as x), rely on reconstructed_answer_en to judge correctness and award marks accordingly.",
  "Provide ideal_answer_en as a concise exemplar solution.",
  "Provide reconstructed_answer_en containing the cleaned, most likely intended student answer.",
  "The 'steps' array should be empty for humanized holistic grading."
].join("\n");

function buildUserMessage(payload: GradePayload): string {
  return [
    "subject:",
    String(payload.subject ?? "general"),
    "",
    "question_text:",
    payload.questionText,
    "",
    "solution_outline:",
    payload.solutionOutline || "",
    "",
    "rubric:",
    JSON.stringify(payload.rubric ?? null, null, 2),
    "",
    "evaluation_config_notes:",
    "Use rubric.evaluation_type when provided.",
    "- If 'fill_blanks': treat blanks as items; award marks_per_blank per correctly filled item; partial credit only if clearly justified; sum to max_marks.",
    "- If 'general' with uniform_marks_per_question: award up to that mark based on correctness and understanding; holistic narrative.",
    "- Always include ideal_answer_en and reconstructed_answer_en. Keep steps[] empty for humanized grading.",
    "",
    "student_answer:",
    payload.studentAnswer || "",
    "",
    "board_rules:",
    boardRules
  ].join("\n");
}

function normalizeGradeResult(raw: unknown, maxMarks: number): GradeResult {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const max_marks = Number.isFinite(Number(obj.max_marks)) ? Number(obj.max_marks) : maxMarks;
  let marks_awarded = Number.isFinite(Number(obj.marks_awarded)) ? Number(obj.marks_awarded) : 0;
  const confidence = Number.isFinite(Number(obj.confidence)) ? Number(obj.confidence) : 0.5;
  const steps: GradeStep[] = [];

  const feedback_en = typeof obj.feedback_en === "string" ? obj.feedback_en : "";
  const ideal_answer_en = typeof obj.ideal_answer_en === "string" ? obj.ideal_answer_en : "";
  const reconstructed_answer_en =
    typeof obj.reconstructed_answer_en === "string" ? obj.reconstructed_answer_en : "";
  const error_tags = Array.isArray(obj.error_tags)
    ? obj.error_tags.map((t) => String(t))
    : [];
  const needs_manual_review =
    typeof obj.needs_manual_review === "boolean" ? obj.needs_manual_review : false;

  const clampedMax = Number.isFinite(max_marks) && max_marks > 0 ? max_marks : maxMarks;
  const recalculated = Math.max(0, Math.min(marks_awarded, clampedMax));
  marks_awarded = Number.isFinite(recalculated) ? recalculated : 0;
  const clampedMarks = Math.max(0, Math.min(marks_awarded, clampedMax));
  const clampedConfidence = Math.max(0, Math.min(confidence, 1));

  return {
    marks_awarded: clampedMarks,
    max_marks: clampedMax,
    confidence: clampedConfidence,
    steps,
    feedback_en,
    ideal_answer_en,
    reconstructed_answer_en,
    error_tags,
    needs_manual_review
  };
}

async function gradeWithAzureOpenAI(payload: GradePayload): Promise<GradeResult> {
  const completion = await azureOpenAI.chat.completions.create({
    model: gradingModel,
    temperature: 0,
    messages: [
      { role: "system", content: systemMessage },
      { role: "user", content: buildUserMessage(payload) }
    ],
    response_format: { type: "json_object" }
  });
  const rawText = completion.choices[0]?.message?.content ?? "";
  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    parsed = extractJsonObject(rawText);
  }
  return normalizeGradeResult(parsed, payload.maxMarks);
}

async function gradeWithOpenAI(payload: GradePayload): Promise<{ result: GradeResult; rawText: string }> {
  if (!env.openaiDevApiKey) throw new Error("Missing env var: OPENAI_API_KEY");

  const client = new OpenAI({ apiKey: env.openaiDevApiKey });
  const completion = await client.chat.completions.create({
    model: env.openaiDevModel,
    temperature: 0,
    messages: [
      { role: "system", content: systemMessage },
      { role: "user", content: buildUserMessage(payload) }
    ],
    response_format: { type: "json_object" }
  });

  const rawText = completion.choices[0]?.message?.content ?? "";
  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    parsed = extractJsonObject(rawText);
  }
  return { result: normalizeGradeResult(parsed, payload.maxMarks), rawText };
}

export async function gradeAnswer(payload: GradePayload): Promise<GradeResult> {
  const provider = env.useAzureOpenAI ? "azure" : "openai";
  process.stdout.write(`[grading] provider=${provider}\n`);

  if (env.useAzureOpenAI) {
    try {
      return await gradeWithAzureOpenAI(payload);
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[grading] azure_failed=${m}\n`);
      try {
        const { result } = await gradeWithOpenAI(payload);
        return result;
      } catch (err2) {
        const message = err2 instanceof Error ? err2.message : "grading_failed";
        return {
          marks_awarded: 0,
          max_marks: payload.maxMarks,
          confidence: 0,
          steps: [],
          feedback_en: `Manual review required: ${message}`,
          ideal_answer_en: "",
          reconstructed_answer_en: "",
          error_tags: ["provider_error"],
          needs_manual_review: true
        };
      }
    }
  }

  try {
    const { result } = await gradeWithOpenAI(payload);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "grading_failed";
    const lower = String(message).toLowerCase();
    const tags =
      lower.includes("quota") || lower.includes("rate") || lower.includes("429")
        ? ["quota_exceeded"]
        : ["invalid_json_output"];
    return {
      marks_awarded: 0,
      max_marks: payload.maxMarks,
      confidence: 0,
      steps: [],
      feedback_en: `Manual review required: ${message}`,
      ideal_answer_en: "",
      reconstructed_answer_en: "",
      error_tags: tags,
      needs_manual_review: true
    };
  }
}
