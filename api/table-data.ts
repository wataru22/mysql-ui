import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withConnection } from "./_db";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { table, page = 1, pageSize = 50, sort, filters, search } = req.body;

  if (!table) {
    return res.status(400).json({ error: "Table name is required" });
  }

  try {
    const result = await withConnection(req, async (conn) => {
      const escapedTable = conn.escapeId(table);

      // Get columns for search
      const [cols] = await conn.query(`SHOW COLUMNS FROM ${escapedTable}`);
      const columns = (cols as { Field: string; Type: string }[]).map((c) => c.Field);

      // Build WHERE clause
      const whereClauses: string[] = [];
      const whereParams: unknown[] = [];

      // Filters
      if (filters && Array.isArray(filters)) {
        for (const f of filters) {
          const col = conn.escapeId(f.column);
          switch (f.operator) {
            case "=":
              whereClauses.push(`${col} = ?`);
              whereParams.push(f.value);
              break;
            case "!=":
              whereClauses.push(`${col} != ?`);
              whereParams.push(f.value);
              break;
            case ">":
              whereClauses.push(`${col} > ?`);
              whereParams.push(f.value);
              break;
            case "<":
              whereClauses.push(`${col} < ?`);
              whereParams.push(f.value);
              break;
            case ">=":
              whereClauses.push(`${col} >= ?`);
              whereParams.push(f.value);
              break;
            case "<=":
              whereClauses.push(`${col} <= ?`);
              whereParams.push(f.value);
              break;
            case "LIKE":
              whereClauses.push(`${col} LIKE ?`);
              whereParams.push(`%${f.value}%`);
              break;
            case "NOT LIKE":
              whereClauses.push(`${col} NOT LIKE ?`);
              whereParams.push(`%${f.value}%`);
              break;
            case "IS NULL":
              whereClauses.push(`${col} IS NULL`);
              break;
            case "IS NOT NULL":
              whereClauses.push(`${col} IS NOT NULL`);
              break;
            case "IN":
              const vals = f.value.split(",").map((v: string) => v.trim());
              whereClauses.push(`${col} IN (${vals.map(() => "?").join(",")})`);
              whereParams.push(...vals);
              break;
          }
        }
      }

      // Global search across all string-like columns
      if (search && search.trim()) {
        const searchCols = (cols as { Field: string; Type: string }[])
          .filter((c) => /char|text|varchar|enum|set/i.test(c.Type))
          .map((c) => c.Field);

        if (searchCols.length > 0) {
          const searchClauses = searchCols.map((c) => `${conn.escapeId(c)} LIKE ?`);
          whereClauses.push(`(${searchClauses.join(" OR ")})`);
          for (const _ of searchCols) {
            whereParams.push(`%${search.trim()}%`);
          }
        }
      }

      const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

      // Count total
      const [countResult] = await conn.query(
        `SELECT COUNT(*) as total FROM ${escapedTable} ${whereStr}`,
        whereParams
      );
      const total = (countResult as { total: number }[])[0].total;

      // Sort
      let orderStr = "";
      if (sort && sort.column) {
        const dir = sort.direction === "desc" ? "DESC" : "ASC";
        orderStr = `ORDER BY ${conn.escapeId(sort.column)} ${dir}`;
      }

      // Pagination
      const offset = (page - 1) * pageSize;
      const limitStr = `LIMIT ${Number(pageSize)} OFFSET ${Number(offset)}`;

      const [rows] = await conn.query(
        `SELECT * FROM ${escapedTable} ${whereStr} ${orderStr} ${limitStr}`,
        whereParams
      );

      return {
        rows: rows as Record<string, unknown>[],
        columns,
        total,
        page,
        pageSize,
      };
    });

    return res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch table data";
    return res.status(400).json({ error: message });
  }
}
