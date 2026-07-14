import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withConnection } from "./_db";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { sql } = req.body;

  if (!sql || !sql.trim()) {
    return res.status(400).json({ error: "SQL query is required" });
  }

  try {
    const result = await withConnection(req, async (conn) => {
      const startTime = Date.now();
      const [rows, fields] = await conn.query(sql.trim());
      const executionTime = Date.now() - startTime;

      // If it's a SELECT-like query, return rows
      if (Array.isArray(rows)) {
        return {
          rows: rows as Record<string, unknown>[],
          fields: (fields as { name: string; type: number }[] | undefined) || [],
          executionTime,
        };
      }

      // For INSERT/UPDATE/DELETE, return affected info
      const result = rows as {
        affectedRows?: number;
        insertId?: number;
        info?: string;
        changedRows?: number;
      };
      return {
        rows: [],
        fields: [],
        affectedRows: result.affectedRows,
        insertId: result.insertId,
        message: result.info || `${result.affectedRows} row(s) affected`,
        executionTime,
      };
    });

    return res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Query execution failed";
    return res.status(400).json({ error: message });
  }
}
