# MySQL Admin (mysql-ui)

A browser-based MySQL client: connect to servers, browse databases and tables, run SQL, and import/export dumps. The UI is a React app with an IDE-style SQL editor (syntax highlighting, line numbers, dark mode). The backend uses **mysql2** and exposes REST-style handlers under `/api`.

## Features

- **Connections** — Quick connect or save bookmarks (host, port, user, optional database, display name). Passwords are **not** stored in saved bookmarks; the active session keeps credentials in **session storage** so they clear with the tab/session.
- **Multi-tab sessions** — Work with several connections in parallel from one window.
- **Schema exploration** — Browse databases, table structure, and row data in a data grid.
- **SQL editor** — Run arbitrary statements against the active database.
- **Import & export** — SQL dump workflows tuned for MySQL (including JSON columns and identifier normalization for portable dumps).

## Stack

| Layer    | Technology                                      |
| --------- | ----------------------------------------------- |
| UI        | React 19, Vite, TypeScript, Tailwind, Radix UI |
| SQL editor| CodeMirror (`@codemirror/lang-sql`)            |
| Local API | Bun (`server.ts`, port **3001** by default)    |
| Database  | mysql2                                          |
| Deploy    | Static build + Vercel serverless `api/*.ts`    |

## Prerequisites

- [Bun](https://bun.sh) (package manager and runtime for the dev API server)
- A reachable MySQL or MariaDB server to connect to from your machine (local dev) or from your deployment (production)

## Local development

Install dependencies:

```bash
bun install
```

Run the Vite dev server and the API server together (API on `3001`, UI proxies `/api` to it):

```bash
bun run dev
```

Alternatively, run them in separate terminals:

```bash
bun run dev:server   # Bun API on :3001
bun run dev:client  # Vite on the default port (check terminal output)
```

Override the API port if needed:

```bash
PORT=4001 bun run dev:server
```

Production build:

```bash
bun run build
bun run preview   # optional: preview the static client
```

## Project layout

```
api/           # Server handlers (Vercel-style exports; also loaded by Bun server.ts)
src/           # React application
server.ts      # Local Bun server that loads api/*.ts and serves /api/*
vercel.json    # Vercel install/build and SPA + API rewrites
```

## Deploying (Vercel)

The repo includes `vercel.json` with Bun install/build and rewrites so `/api/*` hits the serverless functions in `api/` and everything else serves the Vite SPA.

**Important:** Your deployment must be able to reach the MySQL hosts users connect to (network, firewall, and MySQL user `HOST` permissions). The app does not bundle a database; it connects to whatever server the user specifies.

## Security notes

- Treat this like any tool that can execute SQL: only use it on servers and accounts you trust, and avoid exposing the hosted UI to the public internet without authentication unless that matches your threat model.
- Saved connection bookmarks intentionally omit passwords; you re-enter the password when connecting.

## License

This project is private (`"private": true` in `package.json`). Add a `LICENSE` file if you publish it publicly.
