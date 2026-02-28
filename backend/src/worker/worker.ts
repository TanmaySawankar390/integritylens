import { v4 as uuidv4 } from "uuid";
import { query } from "../db/query";
import { analyzeLayout } from "../services/documentIntelligence";
import { uploadBuffer } from "../services/blob";
import { extractLinesFromLayoutResult, orderLines, segmentByQuestionNumbers, findQAPairsFromLines, normalizeQaText, detectNumberBlocks, normalizeForGrading } from "../services/segmentation";
import { gradeAnswer } from "../services/grading.service";
import { env } from "../config/env";

async function processOneScript(scriptId: string): Promise<void> {
  const scriptRow = await query<{ id: string; test_id: string; status: string }>(
    "SELECT TOP 1 id, test_id, status FROM answer_scripts WHERE id = @scriptId",
    { scriptId }
  );
  const script = scriptRow.recordset[0];
  if (!script) return;

  const testId = script.test_id;

  if (script.status === "uploaded") {
    const pages = await query<{
      id: string;
      page_no: number;
      blob_url: string;
      mime_type: string | null;
    }>(
      "SELECT id, page_no, blob_url, mime_type FROM answer_pages WHERE script_id = @scriptId ORDER BY page_no ASC",
      { scriptId }
    );

    for (const page of pages.recordset) {
      try {
        const resp = await fetch(page.blob_url);
        if (!resp.ok) {
          throw new Error(`fetch_failed status=${resp.status}`);
        }
        const buffer = Buffer.from(await resp.arrayBuffer());
        const layout = await analyzeLayout(buffer, page.mime_type ?? undefined);
        const jsonBuffer = Buffer.from(JSON.stringify(layout));
        const ocrBlobPath = `tests/${testId}/scripts/${scriptId}/ocr/page-${page.page_no}-${uuidv4()}.json`;
        const ocrUrl = await uploadBuffer(ocrBlobPath, jsonBuffer, "application/json");

        await query(
          "UPDATE answer_pages SET ocr_result_url = @ocrUrl WHERE id = @pageId",
          { ocrUrl, pageId: page.id }
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`[worker] ocr_failed pageId=${page.id} error=${message}\n`);
      }
    }

    await query("UPDATE answer_scripts SET status = 'ocr_done' WHERE id = @scriptId", {
      scriptId
    });
  }

  const current = await query<{ status: string }>(
    "SELECT TOP 1 status FROM answer_scripts WHERE id = @scriptId",
    { scriptId }
  );
  const status = current.recordset[0]?.status;
  if (status !== "ocr_done") return;

  await query(
    `
    DELETE e
    FROM evaluations e
    INNER JOIN question_answers qa ON qa.id = e.question_answer_id
    WHERE qa.script_id = @scriptId;

    DELETE FROM question_answers WHERE script_id = @scriptId;
    `,
    { scriptId }
  );

  const questions = await query<{
    id: string;
    question_no: number;
    question_text: string;
    max_marks: number;
    solution_outline: string;
    marking_rubric_json: string | null;
  }>(
    "SELECT id, question_no, question_text, max_marks, solution_outline, marking_rubric_json FROM questions WHERE test_id = @testId ORDER BY question_no ASC",
    { testId }
  );
  const questionNos = questions.recordset.map((q: { question_no: number }) => q.question_no);
  const testMeta = await query<{ subject: string | null }>(
    "SELECT TOP 1 subject FROM tests WHERE id = @testId",
    { testId }
  );
  const subject = String(testMeta.recordset[0]?.subject ?? "general");

  const pages = await query<{ id: string; page_no: number; ocr_result_url: string | null }>(
    "SELECT id, page_no, ocr_result_url FROM answer_pages WHERE script_id = @scriptId ORDER BY page_no ASC",
    { scriptId }
  );

  const allLines: any[] = [];
  for (const page of pages.recordset) {
    if (!page.ocr_result_url) continue;
    const layout = await fetch(page.ocr_result_url).then((r) => r.json());
    allLines.push(...extractLinesFromLayoutResult(layout));
  }
  const orderedLines = orderLines(allLines);

  const segments = segmentByQuestionNumbers(orderedLines, questionNos);
  const qaPairs = findQAPairsFromLines(orderedLines);
  const numberBlocks = detectNumberBlocks(orderedLines);
  const segMap = new Map<number, { answerText: string; lineBoxes: any[] }>();
  const extractAns = (t: string) => {
    const normalized = normalizeQaText(String(t ?? ""));
    const m = normalized.match(/ans:\s*([\s\S]*)$/i);
    return m ? m[1].trim() : normalized.trim();
  };
  for (const s of segments) {
    segMap.set(s.questionNo, { answerText: extractAns(s.answerText), lineBoxes: s.lineBoxes ?? [] });
  }
  for (const p of qaPairs) {
    if (!segMap.has(p.questionNo)) {
      segMap.set(p.questionNo, { answerText: String(p.answerText ?? "").trim(), lineBoxes: [] });
    }
  }
  for (const qNo of questionNos) {
    if (!segMap.has(qNo)) {
      const nb = numberBlocks.find((b) => b.questionNo === qNo);
      if (nb) {
        const marker = new RegExp(`^\\s*Q?\\s*${qNo}\\s*[.)\\-:]\\s*`, "i");
        const ans = extractAns(nb.text.replace(marker, ""));
        segMap.set(qNo, { answerText: ans, lineBoxes: nb.lineBoxes ?? [] });
      }
    }
  }

  if (questionNos.length === 1 && !segMap.has(questionNos[0])) {
    const ans = extractAns(orderedLines.map((l) => l.text).join("\n"));
    segMap.set(questionNos[0], { answerText: ans, lineBoxes: orderedLines });
  }

  for (const q of questions.recordset) {
    const seg = segMap.get(q.question_no);
    const answerText = seg?.answerText ?? "";
    const boxes = seg?.lineBoxes ?? [];
    const extractionFailed = !String(answerText).trim();

    const insertedQa = await query<{ id: string }>(
      `
      INSERT INTO question_answers (script_id, question_id, answer_text, answer_bounding_boxes_json)
      OUTPUT INSERTED.id
      VALUES (@scriptId, @questionId, @answerText, @boxesJson)
      `,
      {
        scriptId,
        questionId: q.id,
        answerText,
        boxesJson: boxes.length ? JSON.stringify(boxes) : null
      }
    );

    const questionAnswerId = insertedQa.recordset[0].id;

    const markingRubricJson = q.marking_rubric_json ? JSON.parse(q.marking_rubric_json) : null;
    const answerForGrading = normalizeForGrading(q.question_text, answerText);
    const grade = await gradeAnswer({
      subject,
      questionText: q.question_text,
      solutionOutline: q.solution_outline,
      rubric: markingRubricJson,
      studentAnswer: answerForGrading,
      maxMarks: q.max_marks
    });
    const stepsJson = JSON.stringify(grade.steps ?? []);
    const tagsJson = JSON.stringify(grade.error_tags ?? []);
    const finalFeedback =
      String(grade.feedback_en ?? "") +
      (grade.reconstructed_answer_en ? `\n\nReconstructed answer:\n${String(grade.reconstructed_answer_en)}` : "") +
      (grade.ideal_answer_en ? `\n\nIdeal answer:\n${String(grade.ideal_answer_en)}` : "");

    await query(
      `
      INSERT INTO evaluations (
        question_answer_id, marks_awarded, max_marks, confidence,
        steps_json, feedback_en, feedback_hi, error_tags_json, needs_manual_review,
        model_name, raw_response_json
      )
      VALUES (
        @questionAnswerId, @marksAwarded, @maxMarks, @confidence,
        @stepsJson, @feedbackEn, NULL, @tagsJson, @needsManualReview,
        @modelName, @rawJson
      )
      `,
      {
        questionAnswerId,
        marksAwarded: Number(grade.marks_awarded ?? 0),
        maxMarks: Number(grade.max_marks ?? q.max_marks),
        confidence: Number(grade.confidence ?? 0),
        stepsJson,
        feedbackEn: finalFeedback,
        tagsJson,
        needsManualReview: extractionFailed,
        modelName: env.useAzureOpenAI ? env.openaiModel : env.openaiDevModel,
        rawJson: JSON.stringify(grade)
      }
    );
  }

  const sum = await query<{ total: number }>(
    `
    SELECT SUM(CAST(e.marks_awarded AS FLOAT)) AS total
    FROM evaluations e
    INNER JOIN question_answers qa ON qa.id = e.question_answer_id
    WHERE qa.script_id = @scriptId
    `,
    { scriptId }
  );
  const total = sum.recordset[0]?.total == null ? 0 : Number(sum.recordset[0].total);

  const needsReview = await query<{ c: number }>(
    `
    SELECT COUNT(1) AS c
    FROM evaluations e
    INNER JOIN question_answers qa ON qa.id = e.question_answer_id
    WHERE qa.script_id = @scriptId AND e.needs_manual_review = 1
    `,
    { scriptId }
  );

  await query(
    "UPDATE answer_scripts SET total_marks_awarded = @total, status = @status WHERE id = @scriptId",
    { total, status: needsReview.recordset[0]?.c > 0 ? "needs_review" : "graded", scriptId }
  );
}

async function tick(): Promise<void> {
  if (running) return;
  running = true;

  const pending = await query<{ id: string }>(
    `
    SELECT TOP 1 id
    FROM answer_scripts
    WHERE status IN ('uploaded', 'ocr_done')
    ORDER BY created_at ASC
    `
  );
  const job = pending.recordset[0];
  if (!job) {
    running = false;
    return;
  }

  try {
    await processOneScript(job.id);
  } catch (err) {
    await query("UPDATE answer_scripts SET status = 'error' WHERE id = @id", { id: job.id });
    throw err;
  } finally {
    running = false;
  }
}

let running = false;

export function startWorker(): void {
  const intervalMs = 5000;
  setInterval(() => {
    void tick().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[worker] error=${message}\n`);
    });
  }, intervalMs);
}
