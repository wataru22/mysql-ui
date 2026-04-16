import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withConnection } from "./_db";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { action, table, name, newName, type, nullable, defaultValue } = req.body;

  if (!action || !table) {
    return res.status(400).json({ error: "Action and table are required" });
  }

  try {
    await withConnection(req, async (conn) => {
      const escapedTable = conn.escapeId(table);

      switch (action) {
        case "add": {
          if (!name || !type) {
            throw new Error("Name and type are required to add a column");
          }
          let sql = `ALTER TABLE ${escapedTable} ADD COLUMN ${conn.escapeId(name)} ${type}`;
          sql += nullable ? " NULL" : " NOT NULL";
          if (defaultValue !== undefined && defaultValue !== "") {
            sql += ` DEFAULT ${conn.escape(defaultValue)}`;
          }
          await conn.query(sql);
          break;
        }

        case "modify": {
          if (!name || !type) {
            throw new Error("Name and type are required to modify a column");
          }
          const targetName = newName || name;
          let sql = `ALTER TABLE ${escapedTable} CHANGE COLUMN ${conn.escapeId(name)} ${conn.escapeId(targetName)} ${type}`;
          sql += nullable ? " NULL" : " NOT NULL";
          if (defaultValue !== undefined && defaultValue !== "") {
            sql += ` DEFAULT ${conn.escape(defaultValue)}`;
          }
          await conn.query(sql);
          break;
        }

        case "drop": {
          if (!name) {
            throw new Error("Column name is required");
          }
          await conn.query(`ALTER TABLE ${escapedTable} DROP COLUMN ${conn.escapeId(name)}`);
          break;
        }

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    });

    return res.status(200).json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Column operation failed";
    return res.status(400).json({ error: message });
  }
}
