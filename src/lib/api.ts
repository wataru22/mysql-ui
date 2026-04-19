import type {
  ConnectionConfig,
  SavedConnection,
  TableColumn,
  TableIndex,
  TableDataResponse,
  QueryResult,
  SortConfig,
  FilterConfig,
} from "./types";

function getStoredConnection(): ConnectionConfig | null {
  const raw = localStorage.getItem("db_connection");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function credHeaders(): Record<string, string> {
  const conn = getStoredConnection();
  if (!conn) throw new Error("Not connected");
  return {
    "x-db-credentials": btoa(JSON.stringify(conn)),
    "Content-Type": "application/json",
  };
}

async function apiCall<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...credHeaders(),
      ...(options?.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `API error: ${res.status}`);
  }
  return data as T;
}

// Connection
export async function testConnection(config: ConnectionConfig): Promise<{ ok: boolean; databases: string[] }> {
  const res = await fetch("/api/connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Connection failed");
  return data;
}

export function saveConnection(config: ConnectionConfig) {
  localStorage.setItem("db_connection", JSON.stringify(config));
}

export function loadConnection(): ConnectionConfig | null {
  return getStoredConnection();
}

export function clearConnection() {
  localStorage.removeItem("db_connection");
}

// Saved connections
const SAVED_CONNECTIONS_KEY = "db_saved_connections";

export function getSavedConnections(): SavedConnection[] {
  const raw = localStorage.getItem(SAVED_CONNECTIONS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveNamedConnection(conn: SavedConnection): void {
  const existing = getSavedConnections();
  const idx = existing.findIndex((c) => c.id === conn.id);
  if (idx >= 0) {
    existing[idx] = conn;
  } else {
    existing.push(conn);
  }
  localStorage.setItem(SAVED_CONNECTIONS_KEY, JSON.stringify(existing));
}

export function deleteSavedConnection(id: string): void {
  const existing = getSavedConnections().filter((c) => c.id !== id);
  localStorage.setItem(SAVED_CONNECTIONS_KEY, JSON.stringify(existing));
}

// Databases
export async function listDatabases(): Promise<string[]> {
  const data = await apiCall<{ databases: string[] }>("/api/databases");
  return data.databases;
}

export async function switchDatabase(database: string): Promise<void> {
  const conn = getStoredConnection();
  if (!conn) throw new Error("Not connected");
  conn.database = database;
  saveConnection(conn);
}

// Tables
export async function listTables(): Promise<string[]> {
  const data = await apiCall<{ tables: string[] }>("/api/tables");
  return data.tables;
}

// Table data
export async function getTableData(
  table: string,
  page: number = 1,
  pageSize: number = 50,
  sort?: SortConfig,
  filters?: FilterConfig[],
  search?: string
): Promise<TableDataResponse> {
  return apiCall<TableDataResponse>("/api/table-data", {
    method: "POST",
    body: JSON.stringify({ table, page, pageSize, sort, filters, search }),
  });
}

// Table structure
export async function getTableStructure(
  table: string
): Promise<{ columns: TableColumn[]; indexes: TableIndex[]; createSql: string }> {
  return apiCall("/api/table-structure", {
    method: "POST",
    body: JSON.stringify({ table }),
  });
}

// Execute SQL
export async function executeQuery(sql: string): Promise<QueryResult & { executionTime?: number }> {
  return apiCall("/api/execute", {
    method: "POST",
    body: JSON.stringify({ sql }),
  });
}

// Row operations
export async function insertRow(
  table: string,
  data: Record<string, unknown>
): Promise<{ insertId: number }> {
  return apiCall("/api/rows", {
    method: "POST",
    body: JSON.stringify({ action: "insert", table, data }),
  });
}

export async function updateRow(
  table: string,
  primaryKey: Record<string, unknown>,
  data: Record<string, unknown>
): Promise<{ affectedRows: number }> {
  return apiCall("/api/rows", {
    method: "POST",
    body: JSON.stringify({ action: "update", table, primaryKey, data }),
  });
}

export async function deleteRow(
  table: string,
  primaryKey: Record<string, unknown>
): Promise<{ affectedRows: number }> {
  return apiCall("/api/rows", {
    method: "POST",
    body: JSON.stringify({ action: "delete", table, primaryKey }),
  });
}

// Column operations
export async function addColumn(
  table: string,
  name: string,
  type: string,
  nullable: boolean,
  defaultValue?: string
): Promise<void> {
  await apiCall("/api/columns", {
    method: "POST",
    body: JSON.stringify({ action: "add", table, name, type, nullable, defaultValue }),
  });
}

export async function modifyColumn(
  table: string,
  name: string,
  newName: string,
  type: string,
  nullable: boolean,
  defaultValue?: string
): Promise<void> {
  await apiCall("/api/columns", {
    method: "POST",
    body: JSON.stringify({ action: "modify", table, name, newName, type, nullable, defaultValue }),
  });
}

export async function dropColumn(
  table: string,
  name: string
): Promise<void> {
  await apiCall("/api/columns", {
    method: "POST",
    body: JSON.stringify({ action: "drop", table, name }),
  });
}

// Table operations
export async function createTable(
  name: string,
  columns: { name: string; type: string; nullable: boolean; primaryKey: boolean; autoIncrement: boolean; defaultValue?: string }[]
): Promise<void> {
  await apiCall("/api/table-ops", {
    method: "POST",
    body: JSON.stringify({ action: "create", name, columns }),
  });
}

export async function dropTable(name: string): Promise<void> {
  await apiCall("/api/table-ops", {
    method: "POST",
    body: JSON.stringify({ action: "drop", name }),
  });
}

export async function renameTable(oldName: string, newName: string): Promise<void> {
  await apiCall("/api/table-ops", {
    method: "POST",
    body: JSON.stringify({ action: "rename", name: oldName, newName }),
  });
}

export async function truncateTable(name: string): Promise<void> {
  await apiCall("/api/table-ops", {
    method: "POST",
    body: JSON.stringify({ action: "truncate", name }),
  });
}

export async function duplicateTable(name: string, newName: string): Promise<void> {
  await apiCall("/api/table-ops", {
    method: "POST",
    body: JSON.stringify({ action: "duplicate", name, newName }),
  });
}

// Import
export async function importSql(
  sql: string,
  database?: string
): Promise<{ total: number; executed: number; errors: { statement: number; error: string }[] }> {
  return apiCall("/api/import", {
    method: "POST",
    body: JSON.stringify({ sql, database }),
  });
}

// Export
export async function exportTables(
  tables: string[],
  mode: "structure" | "data" | "both"
): Promise<string> {
  const data = await apiCall<{ sql: string }>("/api/export", {
    method: "POST",
    body: JSON.stringify({ tables, mode }),
  });
  return data.sql;
}
