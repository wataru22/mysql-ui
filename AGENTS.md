## Learned User Preferences

- Reduce browser credential risk: do not persist database or SSH passwords on disk for saved connections; use session-scoped active credentials and prompt for password when connecting to a saved bookmark.
- SQL editor should feel IDE-like: line numbers, SQL syntax highlighting, dark mode that matches the app theme, and editor height that grows with content where appropriate.
- SQL export downloads should include a datetime stamp in the filename (pattern along the lines of `YYYY-MM-DD-HHii` plus database and export mode).
- In narrow panels (e.g. saved connections), prefer wrapping long names and `user@host:port` strings with `break-words` / `break-all` and a `title` tooltip over hard truncation that hides text.
- Prefer bun as the package manager; do not start `bun run dev` unless needed after structural breaks (assume the dev server is already running).
- Do not commit `.cursor/hooks/state/` (continual-learning run/index JSON); keep `AGENTS.md` committed for durable prefs.

## Learned Workspace Facts

- Bun workspace monorepo: `web/` is the Vite React UI + Bun API (`web/server.ts`, `web/api/*`); `app/` is the Electron desktop shell (`electron/main.cjs`).
- Electron spawns Bun `web/server.ts` as an API sidecar; in dev it loads the Vite URL, in prod it serves the static build plus API. Launch scripts must clear `ELECTRON_RUN_AS_NODE` (Cursor often sets it to `1` and breaks `require('electron')`).
- Active connection JSON lives under `sessionStorage` key `db_connection`; legacy `localStorage` values migrate once and are removed. Saved connections in `localStorage` store host, port, user, optional database, display name, and optional SSH tunnel fields (host, user, port, keyPath, localPort)—never DB or SSH passwords; quick connect collects passwords in a dialog.
- Optional SSH tunnels use system `ssh -N -L`: connection form has an SSH Tunnel section; Bun API (`web/api/_sshTunnel.ts`, `web/api/tunnel.ts`, `connect.ts`) spawns the tunnel and MySQL connects to `127.0.0.1:localPort`. Prefer key/agent auth; password auth uses `SSH_ASKPASS`. Stop the tunnel when the last tab using that `tunnelId` closes.
- Dump/import helpers live in `web/api/_sqlDump.ts`: normalize ANSI double-quoted identifiers to MySQL backticks (must respect `''` escapes inside string literals), strip BOM, strip comments, then split on semicolons outside quotes. Export normalizes `SHOW CREATE TABLE` output the same way so imports run on stock MySQL settings.
- For `JSON` columns, export must emit `conn.escape(JSON.stringify(value))` because mysql2 returns already-parsed values; using `escape(String(value))` produces invalid JSON literals on import.
- When editing or displaying cell values that may be objects (e.g. JSON columns), use `JSON.stringify` (or a shared helper aligned with the grid) instead of `String(value)` to avoid `[object Object]`.
