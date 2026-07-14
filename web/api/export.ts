import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { FieldPacket } from "mysql2";
import { Types } from "mysql2";
import type mysql from "mysql2/promise";
import { withConnection } from "./_db";
import { ansiDoubleQuotesToBackticks } from "./_sqlDump";

function isJsonField(f: FieldPacket): boolean {
  const t = f.columnType ?? f.type;
  return t === Types.JSON;
}

function formatInsertValue(
  conn: mysql.Connection,
  v: unknown,
  isJsonColumn: boolean
): string {
  if (v === null || v === undefined) return "NULL";
  if (isJsonColumn) return conn.escape(JSON.stringify(v));
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "1" : "0";
  if (v instanceof Date) return conn.escape(v);
  if (Buffer.isBuffer(v)) return `X'${v.toString("hex")}'`;
  return conn.escape(String(v));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { tables, mode = "both" } = req.body as {
    tables?: string[];
    mode?: "structure" | "data" | "both";
  };

  if (!tables || !Array.isArray(tables) || tables.length === 0) {
    return res.status(400).json({ error: "At least one table name is required" });
  }

  if (!["structure", "data", "both"].includes(mode)) {
    return res.status(400).json({ error: "Mode must be structure, data, or both" });
  }

  try {
    const result = await withConnection(req, async (conn) => {
      const lines: string[] = [];

      lines.push("-- MySQL dump");
      lines.push(`-- Export mode: ${mode}`);
      lines.push(`-- Generated: ${new Date().toISOString()}`);
      lines.push("");
      lines.push("SET FOREIGN_KEY_CHECKS = 0;");
      lines.push("");

      for (const table of tables) {
        const escapedTable = conn.escapeId(table);

        if (mode === "structure" || mode === "both") {
          lines.push(`-- ----------------------------`);
          lines.push(`-- Table structure for ${table}`);
          lines.push(`-- ----------------------------`);
          lines.push(`DROP TABLE IF EXISTS ${escapedTable};`);

          const [createResult] = await conn.query(`SHOW CREATE TABLE ${escapedTable}`);
          const row = (createResult as Record<string, string>[])[0];
          const createKey = Object.keys(row).find((k) => k.toLowerCase() === "create table");
          const createSql = createKey ? row[createKey] : undefined;
          if (!createSql) {
            throw new Error(`Could not read CREATE TABLE for ${table}`);
          }
          lines.push(`${ansiDoubleQuotesToBackticks(createSql)};`);
          lines.push("");
        }

        if (mode === "data" || mode === "both") {
          const [rows, fields] = await conn.query(`SELECT * FROM ${escapedTable}`);
          const dataRows = rows as Record<string, unknown>[];
          const fieldList = fields as FieldPacket[];
          const jsonColumns = new Set(
            fieldList.filter(isJsonField).map((f) => f.name)
          );

          if (dataRows.length > 0) {
            lines.push(`-- ----------------------------`);
            lines.push(`-- Data for ${table}`);
            lines.push(`-- ----------------------------`);
            lines.push(`LOCK TABLES ${escapedTable} WRITE;`);

            // Build INSERT statements in batches of 100
            const batchSize = 100;
            for (let i = 0; i < dataRows.length; i += batchSize) {
              const batch = dataRows.slice(i, i + batchSize);
              const columns = Object.keys(batch[0]);
              const escapedCols = columns.map((c) => conn.escapeId(c)).join(", ");

              const values = batch.map((row) => {
                const vals = columns.map((col) =>
                  formatInsertValue(conn, row[col], jsonColumns.has(col))
                );
                return `(${vals.join(", ")})`;
              });

              lines.push(`INSERT INTO ${escapedTable} (${escapedCols}) VALUES`);
              lines.push(values.join(",\n") + ";");
            }

            lines.push(`UNLOCK TABLES;`);
            lines.push("");
          }
        }
      }

      lines.push("SET FOREIGN_KEY_CHECKS = 1;");
      lines.push("");

      return lines.join("\n");
    });

    return res.status(200).json({ sql: result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Export failed";
    return res.status(400).json({ error: message });
  }
}
