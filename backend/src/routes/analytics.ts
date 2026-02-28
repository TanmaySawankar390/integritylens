import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../http/auth";
import { asyncHandler } from "../http/errors";
import { query } from "../db/query";

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

analyticsRouter.get("/tests/:testId", asyncHandler(async (req: AuthenticatedRequest, res) => {
  const testId = String(req.params.testId);
  const schoolId = req.teacher!.schoolId;

  const allowed = await query(
    "SELECT TOP 1 id FROM tests WHERE id = @testId AND school_id = @schoolId",
    { testId, schoolId }
  );
  if (allowed.recordset.length === 0) {
    res.status(404).json({ error: "test_not_found" });
    return;
  }

  const perQuestion = await query<{
    question_id: string;
    question_no: number;
    question_text: string;
    max_marks: number;
    avg_marks: number;
    graded_count: number;
  }>(
    `
    SELECT
      q.id AS question_id,
      q.question_no,
      q.question_text,
      q.max_marks,
      AVG(CAST(e.marks_awarded AS FLOAT)) AS avg_marks,
      COUNT(e.id) AS graded_count
    FROM questions q
    LEFT JOIN question_answers qa ON qa.question_id = q.id
    LEFT JOIN evaluations e ON e.question_answer_id = qa.id
    WHERE q.test_id = @testId
    GROUP BY q.id, q.question_no, q.question_text, q.max_marks
    ORDER BY q.question_no ASC
    `,
    { testId }
  );

  const tags = await query<{ tag: string; count: number }>(
    `
    WITH tag_rows AS (
      SELECT
        j.[value] AS tag
      FROM evaluations e
      INNER JOIN question_answers qa ON qa.id = e.question_answer_id
      INNER JOIN answer_scripts s ON s.id = qa.script_id
      CROSS APPLY OPENJSON(CASE WHEN ISJSON(e.error_tags_json) = 1 THEN e.error_tags_json ELSE '[]' END) AS j
      WHERE s.test_id = @testId
    )
    SELECT tag, COUNT(1) AS count
    FROM tag_rows
    WHERE tag IS NOT NULL
    GROUP BY tag
    ORDER BY COUNT(1) DESC
    `,
    { testId }
  );

  res.json({
    per_question: perQuestion.recordset.map((r: {
      question_id: string;
      question_no: number;
      question_text: string;
      max_marks: number;
      avg_marks: number;
      graded_count: number;
    }) => ({
      ...r,
      avg_marks: r.avg_marks == null ? 0 : Number(r.avg_marks)
    })),
    common_mistakes: tags.recordset
  });
}));
