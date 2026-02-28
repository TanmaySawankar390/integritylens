import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../http/auth";
import { query } from "../db/query";
import { asyncHandler } from "../http/errors";

export const testsRouter = Router();

testsRouter.use(requireAuth);

testsRouter.get("/", asyncHandler(async (req: AuthenticatedRequest, res) => {
  const schoolId = req.teacher!.schoolId;
  const result = await query<{
    id: string;
    subject: string;
    class_level: string;
    board: string;
    test_date: string;
    total_marks: number;
  }>(
    "SELECT id, subject, class_level, board, test_date, total_marks FROM tests WHERE school_id = @schoolId ORDER BY test_date DESC",
    { schoolId }
  );
  res.json({ tests: result.recordset });
}));

testsRouter.post("/", asyncHandler(async (req: AuthenticatedRequest, res) => {
  const schoolId = req.teacher!.schoolId;
  const teacherId = req.teacher!.teacherId;

  const subject = String(req.body?.subject ?? "").trim();
  const classLevel = String(req.body?.class_level ?? "10").trim();
  const board = String(req.body?.board ?? "CBSE").trim();
  const testDate = String(req.body?.test_date ?? "").trim();
  const totalMarks = Number(req.body?.total_marks ?? 0);

  if (!subject || !testDate || !Number.isFinite(totalMarks)) {
    res.status(400).json({ error: "invalid_payload" });
    return;
  }

  const inserted = await query<{ id: string }>(
    `
    INSERT INTO tests (school_id, teacher_id, subject, class_level, board, test_date, total_marks)
    OUTPUT INSERTED.id
    VALUES (@schoolId, @teacherId, @subject, @classLevel, @board, @testDate, @totalMarks)
    `,
    { schoolId, teacherId, subject, classLevel, board, testDate, totalMarks }
  );

  res.status(201).json({ id: inserted.recordset[0].id });
}));

testsRouter.get("/:testId/questions", asyncHandler(async (req: AuthenticatedRequest, res) => {
  const testId = String(req.params.testId);
  const schoolId = req.teacher!.schoolId;

  const result = await query<{
    id: string;
    question_no: number;
    question_text: string;
    max_marks: number;
    solution_outline: string;
    marking_rubric_json: string;
  }>(
    `
    SELECT q.id, q.question_no, q.question_text, q.max_marks, q.solution_outline, q.marking_rubric_json
    FROM questions q
    INNER JOIN tests t ON t.id = q.test_id
    WHERE q.test_id = @testId AND t.school_id = @schoolId
    ORDER BY q.question_no ASC
    `,
    { testId, schoolId }
  );

  res.json({
    questions: result.recordset.map((q: {
      id: string;
      question_no: number;
      question_text: string;
      max_marks: number;
      solution_outline: string;
      marking_rubric_json: string;
    }) => ({
      ...q,
      marking_rubric_json: q.marking_rubric_json ? JSON.parse(q.marking_rubric_json) : null
    }))
  });
}));

testsRouter.post("/:testId/questions", asyncHandler(async (req: AuthenticatedRequest, res) => {
  const testId = String(req.params.testId);
  const schoolId = req.teacher!.schoolId;

  const exists = await query(
    "SELECT TOP 1 id FROM tests WHERE id = @testId AND school_id = @schoolId",
    { testId, schoolId }
  );
  if (exists.recordset.length === 0) {
    res.status(404).json({ error: "test_not_found" });
    return;
  }

  const questionNo = Number(req.body?.question_no);
  const questionText = String(req.body?.question_text ?? "").trim();
  const maxMarks = Number(req.body?.max_marks ?? 0);
  const solutionOutline = String(req.body?.solution_outline ?? "").trim();
  const markingRubric = req.body?.marking_rubric_json ?? null;

  if (!Number.isFinite(questionNo) || !questionText || !Number.isFinite(maxMarks)) {
    res.status(400).json({ error: "invalid_payload" });
    return;
  }

  const inserted = await query<{ id: string }>(
    `
    INSERT INTO questions (test_id, question_no, question_text, max_marks, solution_outline, marking_rubric_json)
    OUTPUT INSERTED.id
    VALUES (@testId, @questionNo, @questionText, @maxMarks, @solutionOutline, @markingRubricJson)
    `,
    {
      testId,
      questionNo,
      questionText,
      maxMarks,
      solutionOutline,
      markingRubricJson: markingRubric ? JSON.stringify(markingRubric) : null
    }
  );

  res.status(201).json({ id: inserted.recordset[0].id });
}));

testsRouter.get("/:testId/scripts", asyncHandler(async (req: AuthenticatedRequest, res) => {
  const testId = String(req.params.testId);
  const schoolId = req.teacher!.schoolId;

  const result = await query<{
    id: string;
    status: string;
    total_marks_awarded: number | null;
    created_at: string;
  }>(
    `
    SELECT s.id, s.status, s.total_marks_awarded, s.created_at
    FROM answer_scripts s
    INNER JOIN tests t ON t.id = s.test_id
    WHERE s.test_id = @testId AND t.school_id = @schoolId
    ORDER BY s.created_at DESC
    `,
    { testId, schoolId }
  );

  res.json({ scripts: result.recordset });
}));

testsRouter.get("/:testId/scripts/:scriptId", asyncHandler(async (req: AuthenticatedRequest, res) => {
  const testId = String(req.params.testId);
  const scriptId = String(req.params.scriptId);
  const schoolId = req.teacher!.schoolId;

  const script = await query<{
    id: string;
    status: string;
    total_marks_awarded: number | null;
    created_at: string;
  }>(
    `
    SELECT s.id, s.status, s.total_marks_awarded, s.created_at
    FROM answer_scripts s
    INNER JOIN tests t ON t.id = s.test_id
    WHERE s.id = @scriptId AND s.test_id = @testId AND t.school_id = @schoolId
    `,
    { testId, scriptId, schoolId }
  );

  if (script.recordset.length === 0) {
    res.status(404).json({ error: "script_not_found" });
    return;
  }

  const pages = await query<{
    id: string;
    page_no: number;
    blob_url: string;
    mime_type: string;
    ocr_result_url: string | null;
  }>(
    `
    SELECT id, page_no, blob_url, mime_type, ocr_result_url
    FROM answer_pages
    WHERE script_id = @scriptId
    ORDER BY page_no ASC
    `,
    { scriptId }
  );

  const qas = await query<{
    id: string;
    question_id: string;
    question_no: number;
    question_text: string;
    max_marks: number;
    answer_text: string | null;
    answer_bounding_boxes_json: string | null;
    evaluation_id: string | null;
    marks_awarded: number | null;
    confidence: number | null;
    steps_json: string | null;
    feedback_en: string | null;
    feedback_hi: string | null;
    error_tags_json: string | null;
    needs_manual_review: boolean | null;
  }>(
    `
    SELECT
      qa.id,
      qa.question_id,
      q.question_no,
      q.question_text,
      q.max_marks,
      qa.answer_text,
      qa.answer_bounding_boxes_json,
      e.id AS evaluation_id,
      e.marks_awarded,
      e.confidence,
      e.steps_json,
      e.feedback_en,
      e.feedback_hi,
      e.error_tags_json,
      e.needs_manual_review
    FROM question_answers qa
    INNER JOIN questions q ON q.id = qa.question_id
    LEFT JOIN evaluations e ON e.question_answer_id = qa.id
    WHERE qa.script_id = @scriptId
    ORDER BY q.question_no ASC
    `,
    { scriptId }
  );

  res.json({
    script: script.recordset[0],
    pages: pages.recordset,
    question_answers: qas.recordset.map((row: {
      id: string;
      question_id: string;
      question_no: number;
      question_text: string;
      max_marks: number;
      answer_text: string | null;
      answer_bounding_boxes_json: string | null;
      evaluation_id: string | null;
      marks_awarded: number | null;
      confidence: number | null;
      steps_json: string | null;
      feedback_en: string | null;
      feedback_hi: string | null;
      error_tags_json: string | null;
      needs_manual_review: boolean | null;
    }) => ({
      ...row,
      answer_bounding_boxes_json: row.answer_bounding_boxes_json
        ? JSON.parse(row.answer_bounding_boxes_json)
        : null,
      steps_json: row.steps_json ? JSON.parse(row.steps_json) : null,
      error_tags_json: row.error_tags_json ? JSON.parse(row.error_tags_json) : null
    }))
  });
}));
