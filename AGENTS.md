## Learned User Preferences

- Reduce browser credential risk: do not persist database passwords on disk for saved connections; use session-scoped active credentials and prompt for password when connecting to a saved bookmark.
- SQL editor should feel IDE-like: line numbers, SQL syntax highlighting, dark mode that matches the app theme, and editor height that grows with content where appropriate.
- SQL export downloads should include a datetime stamp in the filename (pattern along the lines of `YYYY-MM-DD-HHii` plus database and export mode).
- In narrow panels (e.g. saved connections), prefer wrapping long names and `user@host:port` strings with `break-words` / `break-all` and a `title` tooltip over hard truncation that hides text.

## Learned Workspace Facts

- Active connection JSON lives under `sessionStorage` key `db_connection`; legacy `localStorage` values migrate once and are removed. Saved connections in `localStorage` store host, port, user, optional database, and display name only—never passwords; quick connect collects the password in a dialog.
- Dump/import helpers live in `api/_sqlDump.ts`: normalize ANSI double-quoted identifiers to MySQL backticks (must respect `''` escapes inside string literals), strip BOM, strip comments, then split on semicolons outside quotes. Export normalizes `SHOW CREATE TABLE` output the same way so imports run on stock MySQL settings.
- For `JSON` columns, export must emit `conn.escape(JSON.stringify(value))` because mysql2 returns already-parsed values; using `escape(String(value))` produces invalid JSON literals on import.
- When editing or displaying cell values that may be objects (e.g. JSON columns), use `JSON.stringify` (or a shared helper aligned with the grid) instead of `String(value)` to avoid `[object Object]`.

## Cursor Cloud specific instructions

### Services overview

| Service | Command | Port | Notes |
|---------|---------|------|-------|
| Vite frontend | `npx vite --host 0.0.0.0` | 5173 | Proxies `/api` → `:3001` via `vite.config.ts` |
| Bun API server | `bun run server.ts` | 3001 | Loads all `api/*.ts` handlers (skips `_`-prefixed helpers) |
| MySQL | system service | 3306 | Start with `sudo mysqld --user=mysql --daemonize`; data dir `/var/lib/mysql` |

Combined dev command: `bun run dev` (starts both API server and Vite).

### MySQL setup for testing

MySQL must be running before the API server can do anything useful. After install:
```
sudo mkdir -p /var/run/mysqld && sudo chown mysql:mysql /var/run/mysqld
sudo mysqld --user=mysql --daemonize
```
Then create a root password and TCP user:
```
sudo mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'testpass123'; CREATE USER IF NOT EXISTS 'root'@'127.0.0.1' IDENTIFIED WITH mysql_native_password BY 'testpass123'; GRANT ALL ON *.* TO 'root'@'127.0.0.1' WITH GRANT OPTION; FLUSH PRIVILEGES;"
```
The app connects over TCP (host `127.0.0.1`), not the Unix socket, so the `'root'@'127.0.0.1'` user is required.

### Lint / type-check / build

- Type-check: `npx tsc --noEmit` (no dedicated lint script; TypeScript strict mode is the primary check)
- Build: `npx vite build`
- No test framework is configured in the repo.

### Gotchas

- Bun is required as both package manager and API server runtime; the update script installs it automatically.
- `server.ts` uses Bun-specific APIs (`import { serve } from 'bun'`), so it cannot run under Node.
- The app has no `.env` file; all DB credentials are passed at runtime via the browser UI and forwarded per-request in HTTP headers/body.
