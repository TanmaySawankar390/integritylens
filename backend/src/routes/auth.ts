import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { query } from "../db/query";
import { asyncHandler } from "../http/errors";

export const authRouter = Router();

authRouter.post("/login", asyncHandler(async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");

  if (!email || !password) {
    res.status(400).json({ error: "missing_credentials" });
    return;
  }

  const result = await query<{
    id: string;
    school_id: string;
    password_hash: string;
    display_name: string;
  }>(
    "SELECT TOP 1 id, school_id, password_hash, display_name FROM teachers WHERE email = @email",
    { email }
  );

  const teacher = result.recordset[0];
  if (!teacher) {
    res.status(401).json({ error: "invalid_login" });
    return;
  }

  const ok = await bcrypt.compare(password, teacher.password_hash);
  if (!ok) {
    res.status(401).json({ error: "invalid_login" });
    return;
  }

  const token = jwt.sign(
    { teacherId: teacher.id, schoolId: teacher.school_id },
    env.jwtSecret,
    { expiresIn: "12h" }
  );

  res.json({
    token,
    teacher: { id: teacher.id, displayName: teacher.display_name }
  });
}));
