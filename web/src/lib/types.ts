/** SSH local forward (ssh -L). Passwords/keys are session-only when present. */
export interface SshTunnelConfig {
  enabled: boolean;
  host: string;
  port: number;
  user: string;
  /** Session-only; never persist in saved bookmarks */
  password?: string;
  /** Optional path to private key (IdentityFile) */
  keyPath?: string;
  /** Preferred local bind port; 0 / omitted = auto-assign */
  localPort?: number;
  /** Assigned by API after tunnel starts */
  tunnelId?: string;
}

export interface ConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database?: string;
  ssh?: SshTunnelConfig;
}

/** Bookmark only — DB/SSH passwords are never persisted; enter them when connecting. */
export interface SavedConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  user: string;
  database?: string;
  ssh?: Omit<SshTunnelConfig, "password" | "tunnelId">;
}

export interface ConnectionTab {
  id: string;
  name: string;
  config: ConnectionConfig;
}

export interface TableColumn {
  Field: string;
  Type: string;
  Null: string;
  Key: string;
  Default: string | null;
  Extra: string;
}

export interface TableIndex {
  Table: string;
  Non_unique: number;
  Key_name: string;
  Seq_in_index: number;
  Column_name: string;
  Collation: string;
  Cardinality: number;
  Sub_part: string | null;
  Packed: string | null;
  Null: string;
  Index_type: string;
  Comment: string;
}

export interface QueryResult {
  rows: Record<string, unknown>[];
  fields: { name: string; type: number }[];
  affectedRows?: number;
  insertId?: number;
  message?: string;
}

export interface TableDataResponse {
  rows: Record<string, unknown>[];
  columns: string[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SortConfig {
  column: string;
  direction: "asc" | "desc";
}

export interface FilterConfig {
  column: string;
  operator: string;
  value: string;
}
