import type { VercelRequest, VercelResponse } from "@vercel/node";
import mysql from "mysql2/promise";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { host, port, user, password, database } = req.body;

  if (!host || !user) {
    return res.status(400).json({ error: "Host and user are required" });
  }

  let conn: mysql.Connection | null = null;
  try {
    conn = await mysql.createConnection({
      host,
      port: port || 3306,
      user,
      password: password || "",
      database: database || undefined,
      connectTimeout: 10000,
    });

    const [rows] = await conn.query("SHOW DATABASES");
    const databases = (rows as { Database: string }[]).map((r) => r.Database);

    return res.status(200).json({ ok: true, databases });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return res.status(400).json({ error: message });
  } finally {
    if (conn) await conn.end();
  }
}
