import sql from "mssql";
import { env } from "../config/env";

let poolPromise: Promise<sql.ConnectionPool> | null = null;

export function getPool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool({
      server: env.sqlServer,
      database: env.sqlDatabase,
      user: env.sqlUser,
      password: env.sqlPassword,
      options: {
        encrypt: env.sqlEncrypt,
        trustServerCertificate: false
      }
    }).connect();
  }
  return poolPromise!;
}
