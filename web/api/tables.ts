import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withConnection } from "./_db";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const result = await withConnection(req, async (conn, creds) => {
      if (!creds.database) {
        throw new Error("No database selected");
      }
      const [rows] = await conn.query("SHOW TABLES");
      const key = `Tables_in_${creds.database}`;
      return (rows as Record<string, string>[]).map((r) => Object.values(r)[0]);
    });

    return res.status(200).json({ tables: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list tables";
    return res.status(400).json({ error: message });
  }
}
