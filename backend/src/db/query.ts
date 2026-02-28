import sql from "mssql";
import { getPool } from "./pool";

export async function query<T = unknown>(
  text: string,
  params?: Record<string, unknown>
): Promise<sql.IResult<T>> {
  const pool = await getPool();
  const request = pool.request();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      request.input(key, value as any);
    }
  }
  return request.query<T>(text);
}

