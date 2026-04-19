import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withConnection } from "./_db";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { action, table, data, primaryKey } = req.body;

  if (!action || !table) {
    return res.status(400).json({ error: "Action and table are required" });
  }

  try {
    const result = await withConnection(req, async (conn) => {
      const escapedTable = conn.escapeId(table);

      switch (action) {
        case "insert": {
          if (!data || typeof data !== "object") {
            throw new Error("Data object is required for insert");
          }
          const keys = Object.keys(data);
          const cols = keys.map((k) => conn.escapeId(k)).join(", ");
          const placeholders = keys.map(() => "?").join(", ");
          const values = keys.map((k) => data[k] === "" ? null : data[k]);

          const [result] = await conn.query(
            `INSERT INTO ${escapedTable} (${cols}) VALUES (${placeholders})`,
            values
          );
          return { insertId: (result as { insertId: number }).insertId };
        }

        case "update": {
          if (!data || !primaryKey) {
            throw new Error("Data and primaryKey are required for update");
          }
          const setClauses = Object.keys(data)
            .map((k) => `${conn.escapeId(k)} = ?`)
            .join(", ");
          const setValues = Object.keys(data).map((k) => data[k] === "" ? null : data[k]);

          // Build WHERE clause handling NULL values correctly:
          // SQL requires `col IS NULL` instead of `col = NULL`
          const whereKeys = Object.keys(primaryKey);
          const whereClauses = whereKeys
            .map((k) => primaryKey[k] === null || primaryKey[k] === undefined
              ? `${conn.escapeId(k)} IS NULL`
              : `${conn.escapeId(k)} = ?`)
            .join(" AND ");
          const whereValues = whereKeys
            .filter((k) => primaryKey[k] !== null && primaryKey[k] !== undefined)
            .map((k) => primaryKey[k]);

          const [result] = await conn.query(
            `UPDATE ${escapedTable} SET ${setClauses} WHERE ${whereClauses}`,
            [...setValues, ...whereValues]
          );
          const affectedRows = (result as { affectedRows: number }).affectedRows;
          if (affectedRows === 0) {
            throw new Error("No matching row found to update");
          }
          return { affectedRows };
        }

        case "delete": {
          if (!primaryKey) {
            throw new Error("Primary key is required for delete");
          }
          const deleteWhereKeys = Object.keys(primaryKey);
          const whereClauses = deleteWhereKeys
            .map((k) => primaryKey[k] === null || primaryKey[k] === undefined
              ? `${conn.escapeId(k)} IS NULL`
              : `${conn.escapeId(k)} = ?`)
            .join(" AND ");
          const whereValues = deleteWhereKeys
            .filter((k) => primaryKey[k] !== null && primaryKey[k] !== undefined)
            .map((k) => primaryKey[k]);

          const [result] = await conn.query(
            `DELETE FROM ${escapedTable} WHERE ${whereClauses}`,
            whereValues
          );
          return { affectedRows: (result as { affectedRows: number }).affectedRows };
        }

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    });

    return res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Row operation failed";
    return res.status(400).json({ error: message });
  }
}
