import OpenAI from "openai";
import { env } from "../config/env";

export const azureOpenAI = new OpenAI({
  apiKey: env.openaiApiKey,
  baseURL: `${env.openaiEndpoint.replace(/\/$/, "")}/openai/deployments/${env.openaiDeployment}`,
  defaultQuery: { "api-version": "2024-10-21" },
  defaultHeaders: { "api-key": env.openaiApiKey }
});

export const gradingModel = env.openaiModel;

export function buildGradingPrompt(args: {
  subject: "mathematics" | "language";
  questionText: string;
  maxMarks: number;
  solutionOutline: string;
  markingRubricJson: unknown;
  studentAnswer: string;
}): { system: string; user: string } {
  const system =
    "You are a CBSE Class 10 evaluator. Grade answers step-by-step using the given marking scheme. Award partial marks strictly. Return JSON only. Do not use or infer student identity (name, gender, school).";

  const user = JSON.stringify(
    {
      subject: args.subject,
      question_text: args.questionText,
      max_marks: args.maxMarks,
      solution_outline: args.solutionOutline,
      marking_rubric: args.markingRubricJson,
      student_answer: args.studentAnswer,
      output_json_format: {
        marks_awarded: 3,
        max_marks: 4,
        confidence: 0.85,
        steps: [
          { step: 1, correct: true, marks: 1, comment: "Correct formula" },
          { step: 2, correct: false, marks: 0, comment: "Calculation error" }
        ],
        feedback_en: "Good approach, but calculation mistake in step 2.",
        error_tags: ["calculation_error"],
        needs_manual_review: false
      }
    },
    null,
    2
  );

  return { system, user };
}

export function extractJsonObject(text: string): any {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("No JSON found");
  return JSON.parse(text.slice(start, end + 1));
}
