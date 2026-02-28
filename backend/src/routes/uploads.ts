import { Router } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { requireAuth, type AuthenticatedRequest } from "../http/auth";
import { asyncHandler } from "../http/errors";
import { uploadBuffer } from "../services/blob";
import { query } from "../db/query";
import { analyzeLayout } from "../services/documentIntelligence";
import { extractLinesFromLayoutResult, detectNumberBlocks } from "../services/segmentation";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

export const uploadsRouter = Router();
uploadsRouter.use(requireAuth);

uploadsRouter.post(
  "/tests/:testId/question-paper",
  upload.single("file"),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const testId = String(req.params.testId);
    const schoolId = req.teacher!.schoolId;

    const exists = await query<{ id: string; total_marks: number }>(
      "SELECT TOP 1 id, total_marks FROM tests WHERE id = @testId AND school_id = @schoolId",
      { testId, schoolId }
    );
    if (exists.recordset.length === 0) {
      res.status(404).json({ error: "test_not_found" });
      return;
    }

    const file = req.file as Express.Multer.File | undefined;
    if (!file) {
      res.status(400).json({ error: "no_file_uploaded" });
      return;
    }

    const contentType = file.mimetype || "application/pdf";
    const blobPath = `tests/${testId}/question-paper/${uuidv4()}`;
    const url = await uploadBuffer(blobPath, file.buffer, contentType);

    let layout: unknown;
    try {
      layout = await analyzeLayout(file.buffer, contentType);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: "ocr_failed", message });
      return;
    }

    const lines = extractLinesFromLayoutResult(layout);
    const blocks = detectNumberBlocks(lines);

    if (blocks.length === 0) {
      res.status(400).json({ error: "no_questions_detected", blob_url: url });
      return;
    }

    await query("DELETE FROM questions WHERE test_id = @testId", { testId });

    const evalType = String(req.body?.evaluation_type ?? "general");
    const blanksPerQuestion = Number(req.body?.blanks_per_question ?? 0);
    const marksPerBlank = Number(req.body?.marks_per_blank ?? 0);
    const uniformMarksPerQuestion = Number(req.body?.uniform_marks_per_question ?? 0);
    const totalOverride = Number(req.body?.total_marks_override ?? 0);

    if (Number.isFinite(totalOverride) && totalOverride > 0) {
      await query("UPDATE tests SET total_marks = @tm WHERE id = @testId", {
        tm: totalOverride,
        testId
      });
    }

    const totalMarks = Number(exists.recordset[0].total_marks ?? 0);
    const per = blocks.length > 0 ? Math.floor(totalMarks / blocks.length) : 0;
    let remainder = blocks.length > 0 ? totalMarks % blocks.length : 0;

    const insertedIds: string[] = [];
    for (const b of blocks) {
      const marker = new RegExp(`^\\s*Q?\\s*${b.questionNo}\\s*[.)\\-:]\\s*`, "i");
      const questionText = String(b.text ?? "").replace(marker, "").trim();
      let maxMarks = per + (remainder > 0 ? 1 : 0);
      let rubric: Record<string, unknown> | null = null;

      if (evalType === "fill_blanks" && blanksPerQuestion > 0 && marksPerBlank > 0) {
        maxMarks = blanksPerQuestion * marksPerBlank;
        rubric = {
          evaluation_type: "fill_blanks",
          blanks_per_question: blanksPerQuestion,
          marks_per_blank: marksPerBlank
        };
      } else if (evalType === "general" && uniformMarksPerQuestion > 0) {
        maxMarks = uniformMarksPerQuestion;
        rubric = {
          evaluation_type: "general",
          uniform_marks_per_question: uniformMarksPerQuestion
        };
      } else {
        rubric = { evaluation_type: "general", distributed_evenly: true };
        if (remainder > 0) remainder--;
      }

      const inserted = await query<{ id: string }>(
        `
        INSERT INTO questions (test_id, question_no, question_text, max_marks, solution_outline, marking_rubric_json)
        OUTPUT INSERTED.id
        VALUES (@testId, @questionNo, @questionText, @maxMarks, '', @rubricJson)
        `,
        {
          testId,
          questionNo: b.questionNo,
          questionText,
          maxMarks,
          rubricJson: rubric ? JSON.stringify(rubric) : null
        }
      );
      insertedIds.push(inserted.recordset[0].id);
    }

    res.status(201).json({
      status: "questions_extracted",
      blob_url: url,
      count: insertedIds.length,
      question_ids: insertedIds
    });
  })
);

uploadsRouter.post(
  "/tests/:testId/scripts",
  upload.array("pages", 10),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
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

    const files = (req.files as Express.Multer.File[]) ?? [];
    if (files.length === 0) {
      res.status(400).json({ error: "no_pages_uploaded" });
      return;
    }

    const insertedScript = await query<{ id: string }>(
      `
      INSERT INTO answer_scripts (test_id, student_id, status, total_marks_awarded)
      OUTPUT INSERTED.id
      VALUES (@testId, NULL, 'uploaded', NULL)
      `,
      { testId }
    );
    const scriptId = insertedScript.recordset[0].id;

    let pageNo = 1;
    for (const file of files) {
      const contentType = file.mimetype || "image/jpeg";
      const blobPath = `tests/${testId}/scripts/${scriptId}/pages/${pageNo}-${uuidv4()}`;
      const url = await uploadBuffer(blobPath, file.buffer, contentType);

      await query(
        `
        INSERT INTO answer_pages (script_id, page_no, blob_url, mime_type, ocr_result_url)
        VALUES (@scriptId, @pageNo, @blobUrl, @mimeType, NULL)
        `,
        { scriptId, pageNo, blobUrl: url, mimeType: contentType }
      );
      pageNo++;
    }

    res.status(201).json({ script_id: scriptId, status: "uploaded" });
  })
);

uploadsRouter.post(
  "/tests/:testId/scripts/bulk",
  upload.array("scripts", 50),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
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

    const files = (req.files as Express.Multer.File[]) ?? [];
    if (files.length === 0) {
      res.status(400).json({ error: "no_scripts_uploaded" });
      return;
    }

    let studentNames: string[] = [];
    try {
      const raw = String(req.body?.students ?? "[]");
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) studentNames = arr.map((s) => String(s ?? ""));
    } catch {
      studentNames = [];
    }

    const results: Array<{ script_id: string; student_id: string | null; student_name: string | null }> = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const nameFromBody = studentNames[i] && studentNames[i].trim() ? studentNames[i].trim() : null;
      const base = f.originalname.replace(/\.[^.]+$/, "");
      const studentName = nameFromBody ?? base;

      let studentId: string | null = null;
      if (studentName) {
        const insertedStudent = await query<{ id: string }>(
          `
          INSERT INTO students (school_id, external_id, display_name)
          OUTPUT INSERTED.id
          VALUES (@schoolId, NULL, @displayName)
          `,
          { schoolId, displayName: studentName }
        );
        studentId = insertedStudent.recordset[0].id;
      }

      const insertedScript = await query<{ id: string }>(
        `
        INSERT INTO answer_scripts (test_id, student_id, status, total_marks_awarded)
        OUTPUT INSERTED.id
        VALUES (@testId, @studentId, 'uploaded', NULL)
        `,
        { testId, studentId }
      );
      const scriptId = insertedScript.recordset[0].id;

      const contentType = f.mimetype || "application/pdf";
      const blobPath = `tests/${testId}/scripts/${scriptId}/file-${uuidv4()}`;
      const url = await uploadBuffer(blobPath, f.buffer, contentType);

      await query(
        `
        INSERT INTO answer_pages (script_id, page_no, blob_url, mime_type, ocr_result_url)
        VALUES (@scriptId, 1, @blobUrl, @mimeType, NULL)
        `,
        { scriptId, blobUrl: url, mimeType: contentType }
      );

      results.push({ script_id: scriptId, student_id: studentId, student_name: studentName });
    }

    res.status(201).json({ status: "uploaded", results });
  })
);
