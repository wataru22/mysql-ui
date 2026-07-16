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

const DB_CONNECTION_KEY = "db_connection";

/** Active credentials: tab-scoped (session), not disk-persisted like localStorage. */
function migrateLegacyDbConnectionToSession(): void {
  const legacy = localStorage.getItem(DB_CONNECTION_KEY);
  if (!legacy) return;
  try {
    JSON.parse(legacy) as ConnectionConfig;
    if (!sessionStorage.getItem(DB_CONNECTION_KEY)) {
      sessionStorage.setItem(DB_CONNECTION_KEY, legacy);
    }
  } catch {
    /* ignore corrupt legacy */
  }
  localStorage.removeItem(DB_CONNECTION_KEY);
}

function getStoredConnection(): ConnectionConfig | null {
  migrateLegacyDbConnectionToSession();
  const raw = sessionStorage.getItem(DB_CONNECTION_KEY);
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
export async function testConnection(
  config: ConnectionConfig
): Promise<{ ok: boolean; databases: string[]; tunnelId?: string; localPort?: number }> {
  const res = await fetch("/api/connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Connection failed");
  return data;
}

/** Apply tunnel assignment from connect response onto the config used for subsequent API calls. */
export function withTunnelAssignment(
  config: ConnectionConfig,
  result: { tunnelId?: string; localPort?: number }
): ConnectionConfig {
  if (!config.ssh?.enabled || !result.tunnelId || !result.localPort) return config;
  return {
    ...config,
    ssh: {
      ...config.ssh,
      tunnelId: result.tunnelId,
      localPort: result.localPort,
    },
  };
}

export async function stopSshTunnel(tunnelId: string): Promise<void> {
  if (!tunnelId) return;
  try {
    await fetch(`/api/tunnel?id=${encodeURIComponent(tunnelId)}`, { method: "DELETE" });
  } catch {
    /* best-effort */
  }
}

export function saveConnection(config: ConnectionConfig) {
  migrateLegacyDbConnectionToSession();
  sessionStorage.setItem(DB_CONNECTION_KEY, JSON.stringify(config));
}

export function loadConnection(): ConnectionConfig | null {
  return getStoredConnection();
}

export function clearConnection() {
  localStorage.removeItem(DB_CONNECTION_KEY);
  sessionStorage.removeItem(DB_CONNECTION_KEY);
}

// Saved connections
const SAVED_CONNECTIONS_KEY = "db_saved_connections";

function normalizeSavedSsh(raw: unknown): SavedConnection["ssh"] | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const s = raw as Record<string, unknown>;
  if (s.enabled !== true) return undefined;
  const host = typeof s.host === "string" ? s.host : "";
  const user = typeof s.user === "string" ? s.user : "";
  if (!host || !user) return undefined;
  const port = typeof s.port === "number" && Number.isFinite(s.port) ? s.port : 22;
  const keyPath = typeof s.keyPath === "string" && s.keyPath.length > 0 ? s.keyPath : undefined;
  const localPort =
    typeof s.localPort === "number" && Number.isFinite(s.localPort) && s.localPort > 0
      ? s.localPort
      : undefined;
  return { enabled: true, host, port, user, keyPath, localPort };
}

function normalizeSavedEntry(item: unknown): SavedConnection | null {
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.name !== "string") return null;
  const host = typeof o.host === "string" ? o.host : "";
  const port = typeof o.port === "number" && Number.isFinite(o.port) ? o.port : 3306;
  const user = typeof o.user === "string" ? o.user : "";
  const database =
    typeof o.database === "string" && o.database.length > 0 ? o.database : undefined;
  const ssh = normalizeSavedSsh(o.ssh);
  return { id: o.id, name: o.name, host, port, user, database, ...(ssh ? { ssh } : {}) };
}

export function getSavedConnections(): SavedConnection[] {
  const raw = localStorage.getItem(SAVED_CONNECTIONS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const list: SavedConnection[] = [];
    let needsRewrite = false;
    for (const item of parsed) {
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        if ("password" in o) needsRewrite = true;
        if (
          o.ssh &&
          typeof o.ssh === "object" &&
          ("password" in (o.ssh as object) || "tunnelId" in (o.ssh as object))
        ) {
          needsRewrite = true;
        }
      }
      const n = normalizeSavedEntry(item);
      if (n) list.push(n);
    }
    if (needsRewrite) {
      localStorage.setItem(SAVED_CONNECTIONS_KEY, JSON.stringify(list));
    }
    return list;
  } catch {
    return [];
  }
}

export function saveNamedConnection(conn: SavedConnection): void {
  const existing = getSavedConnections();
  const idx = existing.findIndex((c) => c.id === conn.id);
  const ssh = conn.ssh?.enabled
    ? {
        enabled: true as const,
        host: conn.ssh.host,
        port: conn.ssh.port || 22,
        user: conn.ssh.user,
        ...(conn.ssh.keyPath ? { keyPath: conn.ssh.keyPath } : {}),
        ...(conn.ssh.localPort && conn.ssh.localPort > 0
          ? { localPort: conn.ssh.localPort }
          : {}),
      }
    : undefined;
  const safe: SavedConnection = {
    id: conn.id,
    name: conn.name,
    host: conn.host,
    port: conn.port,
    user: conn.user,
    database: conn.database,
    ...(ssh ? { ssh } : {}),
  };
  if (idx >= 0) {
    existing[idx] = safe;
  } else {
    existing.push(safe);
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
