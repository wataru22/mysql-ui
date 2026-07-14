/**
 * Helpers for mysqldump-style SQL: ANSI double-quoted identifiers → MySQL backticks,
 * comment stripping, and statement splitting. Single-quoted literals use SQL '' escapes.
 */

const BOM = "\uFEFF";

/** Strip UTF-8 BOM if present */
export function stripBom(sql: string): string {
  return sql.startsWith(BOM) ? sql.slice(BOM.length) : sql;
}

/**
 * Replace ANSI / PostgreSQL-style "id" and curly "smart quotes" with MySQL `id`.
 * Ignores double quotes inside single-quoted string literals (handles '' escapes and \ escapes).
 */
export function ansiDoubleQuotesToBackticks(sql: string): string {
  let out = "";
  let i = 0;
  let inSingle = false;

  while (i < sql.length) {
    const ch = sql[i];

    if (inSingle) {
      if (ch === "\\" && i + 1 < sql.length) {
        out += ch + sql[i + 1];
        i += 2;
        continue;
      }
      if (ch === "'" && i + 1 < sql.length && sql[i + 1] === "'") {
        out += "''";
        i += 2;
        continue;
      }
      if (ch === "'") {
        out += ch;
        inSingle = false;
        i++;
        continue;
      }
      out += ch;
      i++;
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      out += ch;
      i++;
      continue;
    }

    const c = ch.charCodeAt(0);
    if (c === 0x201c || c === 0x201d) {
      out += "`";
      i++;
      continue;
    }

    if (ch === '"') {
      out += "`";
      i++;
      continue;
    }

    out += ch;
    i++;
  }

  return out;
}

/**
 * Remove -- and /* *\/ comments while respecting string literals (same '' / \ rules).
 */
export function stripSqlComments(sql: string): string {
  let out = "";
  let i = 0;
  let inSingle = false;
  let inBacktick = false;

  while (i < sql.length) {
    const ch = sql[i];

    if (inBacktick) {
      if (ch === "`" && i + 1 < sql.length && sql[i + 1] === "`") {
        out += "``";
        i += 2;
        continue;
      }
      if (ch === "`") {
        out += ch;
        inBacktick = false;
        i++;
        continue;
      }
      out += ch;
      i++;
      continue;
    }

    if (inSingle) {
      if (ch === "\\" && i + 1 < sql.length) {
        out += ch + sql[i + 1];
        i += 2;
        continue;
      }
      if (ch === "'" && i + 1 < sql.length && sql[i + 1] === "'") {
        out += "''";
        i += 2;
        continue;
      }
      if (ch === "'") {
        out += ch;
        inSingle = false;
        i++;
        continue;
      }
      out += ch;
      i++;
      continue;
    }

    if (ch === "`") {
      inBacktick = true;
      out += ch;
      i++;
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      out += ch;
      i++;
      continue;
    }

    if (ch === "/" && sql[i + 1] === "*") {
      const end = sql.indexOf("*/", i + 2);
      i = end === -1 ? sql.length : end + 2;
      continue;
    }

    if (
      ch === "-" &&
      sql[i + 1] === "-" &&
      (sql[i + 2] === " " || sql[i + 2] === "\t" || sql[i + 2] === "\n" || i + 2 >= sql.length)
    ) {
      const nl = sql.indexOf("\n", i);
      i = nl === -1 ? sql.length : nl + 1;
      continue;
    }

    out += ch;
    i++;
  }

  return out;
}

/**
 * Split on semicolons outside of quotes (', ", `).
 */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let escaped = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];

    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      current += ch;
      escaped = true;
      continue;
    }

    if (ch === "'" && !inDouble && !inBacktick) {
      if (inSingle && i + 1 < sql.length && sql[i + 1] === "'") {
        current += "''";
        i++;
        continue;
      }
      inSingle = !inSingle;
      current += ch;
      continue;
    }

    if (ch === '"' && !inSingle && !inBacktick) {
      inDouble = !inDouble;
      current += ch;
      continue;
    }

    if (ch === "`" && !inSingle && !inDouble) {
      if (inBacktick && i + 1 < sql.length && sql[i + 1] === "`") {
        current += "``";
        i++;
        continue;
      }
      inBacktick = !inBacktick;
      current += ch;
      continue;
    }

    if (ch === ";" && !inSingle && !inDouble && !inBacktick) {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = "";
      continue;
    }

    current += ch;
  }

  const trimmed = current.trim();
  if (trimmed) statements.push(trimmed);

  return statements;
}
