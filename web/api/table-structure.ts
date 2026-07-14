import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withConnection } from "./_db";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { table } = req.body;

  if (!table) {
    return res.status(400).json({ error: "Table name is required" });
  }

  try {
    const result = await withConnection(req, async (conn) => {
      const escapedTable = conn.escapeId(table);

      const [columns] = await conn.query(`SHOW FULL COLUMNS FROM ${escapedTable}`);
      const [indexes] = await conn.query(`SHOW INDEX FROM ${escapedTable}`);
      const [createTable] = await conn.query(`SHOW CREATE TABLE ${escapedTable}`);
      const createSql = (createTable as Record<string, string>[])[0]["Create Table"] || "";

      return {
        columns,
        indexes,
        createSql,
      };
    });

    return res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch table structure";
    return res.status(400).json({ error: message });
  }
}
