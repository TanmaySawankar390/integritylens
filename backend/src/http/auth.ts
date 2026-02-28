import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { query } from "../db/query";

export type AuthenticatedRequest = Request & {
  teacher?: { teacherId: string; schoolId: string };
};

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (!token) {
    res.status(401).json({ error: "missing_token" });
    return;
  }

  void (async () => {
    try {
      const payload = jwt.verify(token, env.jwtSecret) as {
        teacherId: string;
        schoolId: string;
      };

      const teacher = await query<{ school_id: string }>(
        "SELECT TOP 1 school_id FROM teachers WHERE id = @teacherId",
        { teacherId: payload.teacherId }
      );
      const row = teacher.recordset[0];
      if (!row?.school_id) {
        res.status(401).json({ error: "invalid_token" });
        return;
      }

      req.teacher = { teacherId: payload.teacherId, schoolId: row.school_id };
      next();
    } catch {
      res.status(401).json({ error: "invalid_token" });
    }
  })();
}
