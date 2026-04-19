import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withConnection } from "./_db";
import {
  ansiDoubleQuotesToBackticks,
  splitSqlStatements,
  stripBom,
  stripSqlComments,
} from "./_sqlDump";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { sql, database } = req.body as { sql?: string; database?: string };

  if (!sql || !sql.trim()) {
    return res.status(400).json({ error: "SQL content is required" });
  }

  try {
    const result = await withConnection(req, async (conn) => {
      // Optionally create and switch to a new database
      if (database && database.trim()) {
        const dbName = conn.escapeId(database.trim());
        await conn.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`);
        await conn.query(`USE ${dbName}`);
      }

      const raw = stripBom(sql);
      // Normalize identifiers before comment strip so quote state stays consistent
      const normalized = ansiDoubleQuotesToBackticks(raw);
      const cleaned = stripSqlComments(normalized);
      const statements = splitSqlStatements(cleaned);

      let executed = 0;
      let errors: { statement: number; error: string }[] = [];

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        if (!stmt) continue;
        try {
          await conn.query(stmt);
          executed++;
        } catch (err: unknown) {
          errors.push({
            statement: i + 1,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      return {
        total: statements.length,
        executed,
        errors,
      };
    });

    return res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Import failed";
    return res.status(400).json({ error: message });
  }
}
