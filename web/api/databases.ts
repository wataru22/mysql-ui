import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withConnection } from "./_db";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const result = await withConnection(req, async (conn) => {
      const [rows] = await conn.query("SHOW DATABASES");
      return (rows as { Database: string }[]).map((r) => r.Database);
    });

    return res.status(200).json({ databases: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to list databases";
    return res.status(400).json({ error: message });
  }
}
