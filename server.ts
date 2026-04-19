/**
 * Local development API server.
 * Run with: bun run server.ts
 *
 * This serves the /api/* routes locally so you can develop
 * without Vercel. The Vite dev server proxies /api to this.
 */
import { serve } from 'bun'
import { readdir } from 'fs/promises'
import { join } from 'path'

const API_DIR = join(import.meta.dir, 'api')
const PORT = Number(process.env.PORT) || 3001

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

    // Create a mock VercelRequest/VercelResponse
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

await loadRoutes()

serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)

    // Handle CORS preflight
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

    // Match API routes
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
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  },
})

console.log(`API server running on http://localhost:${PORT}`)
