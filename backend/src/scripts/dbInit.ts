import fs from "node:fs";
import path from "node:path";
import { query } from "../db/query";

async function main(): Promise<void> {
  const schemaPath = path.join(process.cwd(), "sql", "schema.sql");
  const sqlText = fs.readFileSync(schemaPath, "utf8");
  await query(sqlText);
  process.stdout.write("db:init complete\n");
}

void main();

