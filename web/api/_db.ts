import type { VercelRequest } from "@vercel/node";
import mysql from "mysql2/promise";

export interface DbCredentials {
  host: string;
  port: number;
  user: string;
  password: string;
  database?: string;
}

export function parseCredentials(req: VercelRequest): DbCredentials {
  const header = req.headers["x-db-credentials"];
  if (!header || typeof header !== "string") {
    throw new Error("Missing database credentials");
  }
  try {
    return JSON.parse(Buffer.from(header, "base64").toString("utf-8"));
  } catch {
    throw new Error("Invalid credentials format");
  }
}

export async function getConnection(creds: DbCredentials): Promise<mysql.Connection> {
  return mysql.createConnection({
    host: creds.host,
    port: creds.port,
    user: creds.user,
    password: creds.password,
    database: creds.database || undefined,
    connectTimeout: 10000,
    // Return rows as plain objects
    rowsAsArray: false,
  });
}

export async function withConnection<T>(
  req: VercelRequest,
  handler: (conn: mysql.Connection, creds: DbCredentials) => Promise<T>
): Promise<T> {
  const creds = parseCredentials(req);
  const conn = await getConnection(creds);
  try {
    return await handler(conn, creds);
  } finally {
    await conn.end();
  }
}
