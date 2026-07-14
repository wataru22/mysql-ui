# MySQL Admin (mysql-ui)

A MySQL client with a React UI and mysql2 API. Available as a **web app** (`web/`) and an **Electron desktop app** (`app/`).

## Layout

| Path | Role |
| ---- | ---- |
| `web/` | Vite + React UI, Bun API (`server.ts` + `api/*`), Vercel deploy |
| `app/` | Electron shell — spawns the web API and loads the UI |

## Features

- **Connections** — Quick connect or save bookmarks (host, port, user, optional database, display name). Passwords are **not** stored in saved bookmarks; the active session keeps credentials in **session storage**.
- **Multi-tab sessions** — Work with several connections in parallel from one window.
- **Schema exploration** — Browse databases, table structure, and row data.
- **SQL editor** — Run statements against the active database.
- **Import & export** — SQL dump workflows tuned for MySQL.

## Prerequisites

- [Bun](https://bun.sh)
- A reachable MySQL or MariaDB server
- Electron app also needs Bun on `PATH` at runtime (API sidecar)

## Install

From the repo root:

```bash
bun install
```

## Web (browser)

```bash
bun run dev          # API :3001 + Vite :5173
bun run build        # production client → web/dist
```

Or from `web/`:

```bash
cd web && bun run dev
```

## Electron

Dev (starts Vite client + Electron; Electron starts the API on port 3001):

```bash
bun run dev:app
```

Production-style local run (build UI, then Electron serves static + API):

```bash
bun run build:app
bun run start:app
```

Package installers:

```bash
bun run dist:app
```

## Deploy (web)

Vercel root directory should be `web/`. See `web/vercel.json`.

## Stack

| Layer | Technology |
| ----- | ---------- |
| UI | React 19, Vite, TypeScript, Tailwind, Radix UI |
| SQL editor | CodeMirror (`@codemirror/lang-sql`) |
| API | Bun (`web/server.ts`) + mysql2 |
| Desktop | Electron (`app/`) |
| Deploy | Static build + Vercel serverless `web/api/*.ts` |
