import bcrypt from "bcryptjs";
import { query } from "../db/query";

async function main(): Promise<void> {
  const email = (process.env.SEED_TEACHER_EMAIL ?? "teacher@demo.school").toLowerCase();
  const password = process.env.SEED_TEACHER_PASSWORD ?? "Demo@1234";
  const displayName = process.env.SEED_TEACHER_NAME ?? "Demo Teacher";

  const schoolName = process.env.SEED_SCHOOL_NAME ?? "Demo CBSE School";

  const existingSchool = await query<{ id: string }>(
    "SELECT TOP 1 id FROM schools WHERE name = @name",
    { name: schoolName }
  );
  const schoolId =
    existingSchool.recordset[0]?.id ??
    (
      await query<{ id: string }>(
        "INSERT INTO schools (name) OUTPUT INSERTED.id VALUES (@name)",
        { name: schoolName }
      )
    ).recordset[0].id;

  const existingTeacher = await query<{ id: string }>(
    "SELECT TOP 1 id FROM teachers WHERE email = @email",
    { email }
  );
  const hash = await bcrypt.hash(password, 10);
  if (existingTeacher.recordset.length === 0) {
    await query(
      "INSERT INTO teachers (school_id, email, password_hash, display_name) VALUES (@schoolId, @email, @hash, @displayName)",
      { schoolId, email, hash, displayName }
    );
  } else {
    await query(
      `
      UPDATE teachers
      SET school_id = @schoolId, password_hash = @hash, display_name = @displayName
      WHERE email = @email
      `,
      { schoolId, email, hash, displayName }
    );
  }

  process.stdout.write(`Seeded teacher: ${email} / ${password}\n`);
}

void main();
