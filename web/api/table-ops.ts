import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withConnection } from "./_db";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { action, name, newName, columns } = req.body;

  if (!action || !name) {
    return res.status(400).json({ error: "Action and table name are required" });
  }

  try {
    await withConnection(req, async (conn) => {
      switch (action) {
        case "create": {
          if (!columns || !Array.isArray(columns) || columns.length === 0) {
            throw new Error("At least one column is required");
          }
          const colDefs = columns.map((col: {
            name: string;
            type: string;
            nullable: boolean;
            primaryKey: boolean;
            autoIncrement: boolean;
            defaultValue?: string;
          }) => {
            let def = `${conn.escapeId(col.name)} ${col.type}`;
            if (!col.nullable) def += " NOT NULL";
            if (col.autoIncrement) def += " AUTO_INCREMENT";
            if (col.defaultValue) def += ` DEFAULT ${conn.escape(col.defaultValue)}`;
            return def;
          });

          const pkCols = columns
            .filter((c: { primaryKey: boolean }) => c.primaryKey)
            .map((c: { name: string }) => conn.escapeId(c.name));

          if (pkCols.length > 0) {
            colDefs.push(`PRIMARY KEY (${pkCols.join(", ")})`);
          }

          await conn.query(
            `CREATE TABLE ${conn.escapeId(name)} (${colDefs.join(", ")}) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
          );
          break;
        }

        case "drop": {
          await conn.query(`DROP TABLE ${conn.escapeId(name)}`);
          break;
        }

        case "rename": {
          if (!newName) {
            throw new Error("New name is required");
          }
          await conn.query(`RENAME TABLE ${conn.escapeId(name)} TO ${conn.escapeId(newName)}`);
          break;
        }

        case "truncate": {
          await conn.query(`TRUNCATE TABLE ${conn.escapeId(name)}`);
          break;
        }

        case "duplicate": {
          if (!newName) {
            throw new Error("New name is required");
          }
          await conn.query(`CREATE TABLE ${conn.escapeId(newName)} LIKE ${conn.escapeId(name)}`);
          await conn.query(`INSERT INTO ${conn.escapeId(newName)} SELECT * FROM ${conn.escapeId(name)}`);
          break;
        }

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    });

    return res.status(200).json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Table operation failed";
    return res.status(400).json({ error: message });
  }
}
