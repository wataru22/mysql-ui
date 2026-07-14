/**
 * Local development / Electron API server.
 * Run with: bun run server.ts
 *
 * Serves /api/* routes. When SERVE_STATIC=1, also serves the Vite build from dist/.
 */
import { serve } from 'bun'
import { readdir } from 'fs/promises'
import { join, extname } from 'path'

const API_DIR = join(import.meta.dir, 'api')
const DIST_DIR = join(import.meta.dir, 'dist')
const PORT = Number(process.env.PORT) || 3001
const SERVE_STATIC = process.env.SERVE_STATIC === '1' || process.env.SERVE_STATIC === 'true'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

// Pre-load all API route handlers
const routes: Record<string, (req: Request) => Promise<Response>> = {}

async function loadRoutes() {
  const files = await readdir(API_DIR)
  for (const file of files) {
    if (file.startsWith('_') || !file.endsWith('.ts')) continue
    const routeName = file.replace('.ts', '')
    const mod = await import(join(API_DIR, file))
    routes[routeName] = mod.default
  }
  console.log(`Loaded API routes: ${Object.keys(routes).join(', ')}`)
}

// Adapt Vercel-style handler to Bun's native Request/Response
function adaptHandler(handler: Function) {
  return async (req: Request): Promise<Response> => {
    const url = new URL(req.url)
    let body: any = undefined

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      try {
        body = await req.json()
      } catch {
        body = {}
      }
    }

    const headers: Record<string, string | string[]> = {}
    req.headers.forEach((value, key) => {
      headers[key] = value
    })

    const vercelReq = {
      method: req.method,
      url: url.pathname,
      headers,
      query: Object.fromEntries(url.searchParams),
      body,
    }

    let statusCode = 200
    let responseBody: any = {}
    let responseHeaders: Record<string, string> = {}

    const vercelRes = {
      status(code: number) {
        statusCode = code
        return this
      },
      json(data: any) {
        responseBody = data
        responseHeaders['Content-Type'] = 'application/json'
        return this
      },
      setHeader(key: string, value: string) {
        responseHeaders[key] = value
        return this
      },
    }

    await handler(vercelReq, vercelRes)

    return new Response(JSON.stringify(responseBody), {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': '*',
        ...responseHeaders,
      },
    })
  }
}

async function serveStatic(pathname: string): Promise<Response | null> {
  const safePath = pathname === '/' ? '/index.html' : pathname
  const filePath = join(DIST_DIR, safePath)
  if (!filePath.startsWith(DIST_DIR)) return null

  let file = Bun.file(filePath)
  if (!(await file.exists())) {
    // SPA fallback
    file = Bun.file(join(DIST_DIR, 'index.html'))
    if (!(await file.exists())) return null
    return new Response(file, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const type = MIME[extname(filePath)] || 'application/octet-stream'
  return new Response(file, { headers: { 'Content-Type': type } })
}

await loadRoutes()

serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)

    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': '*',
        },
      })
    }

    const match = url.pathname.match(/^\/api\/(.+)$/)
    if (match) {
      const routeName = match[1]
      const handler = routes[routeName]
      if (handler) {
        try {
          return await adaptHandler(handler)(req)
        } catch (err) {
          console.error(`Error in /api/${routeName}:`, err)
          return new Response(
            JSON.stringify({
              error:
                err instanceof Error ? err.message : 'Internal server error',
            }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }
      }
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (SERVE_STATIC) {
      const staticRes = await serveStatic(url.pathname)
      if (staticRes) return staticRes
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  },
})

console.log(
  `API server running on http://localhost:${PORT}` +
    (SERVE_STATIC ? ' (serving static from dist/)' : ''),
)
