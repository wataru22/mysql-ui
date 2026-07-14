const { app, BrowserWindow } = require('electron')
const { createServer } = require('node:net')
const { join } = require('node:path')
const { existsSync } = require('node:fs')
const { spawn } = require('node:child_process')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

function webRoot() {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'web')
  }
  return join(__dirname, '..', '..', 'web')
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (addr && typeof addr === 'object') {
        const port = addr.port
        server.close(() => resolve(port))
      } else {
        server.close(() => reject(new Error('Could not allocate port')))
      }
    })
    server.on('error', reject)
  })
}

function portAvailable(port) {
  return new Promise((resolve) => {
    const server = createServer()
    server.once('error', () => resolve(false))
    server.listen(port, '127.0.0.1', () => {
      server.close(() => resolve(true))
    })
  })
}

function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tryOnce = async () => {
      try {
        await fetch(url)
        resolve()
        return
      } catch {
        /* retry */
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`))
        return
      }
      setTimeout(tryOnce, 200)
    }
    tryOnce()
  })
}

let apiChild = null
let mainWindow = null

async function startApiServer(port) {
  const root = webRoot()
  const serverEntry = join(root, 'server.ts')
  if (!existsSync(serverEntry)) {
    throw new Error(`API server not found at ${serverEntry}`)
  }

  apiChild = spawn('bun', ['run', serverEntry], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      SERVE_STATIC: isDev ? '0' : '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  apiChild.stdout?.on('data', (chunk) => {
    console.log(`[api] ${chunk.toString().trimEnd()}`)
  })
  apiChild.stderr?.on('data', (chunk) => {
    console.error(`[api] ${chunk.toString().trimEnd()}`)
  })
  apiChild.on('exit', (code, signal) => {
    console.log(`[api] exited code=${code} signal=${signal}`)
    apiChild = null
  })

  await waitForServer(`http://127.0.0.1:${port}/api/connect`)
}

function stopApiServer() {
  if (!apiChild) return
  apiChild.kill('SIGTERM')
  apiChild = null
}

async function createWindow() {
  const port = isDev
    ? (await portAvailable(3001))
      ? 3001
      : await findFreePort()
    : await findFreePort()

  if (isDev && port !== 3001) {
    console.warn(
      `[electron] port 3001 busy; API on ${port}. Update web/vite.config.ts proxy target.`,
    )
  }

  await startApiServer(port)

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    title: 'MySQL UI',
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  if (isDev) {
    const viteUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
    await waitForServer(viteUrl, 20000)
    await mainWindow.loadURL(viteUrl)
  } else {
    await mainWindow.loadURL(`http://127.0.0.1:${port}`)
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  try {
    await createWindow()
  } catch (err) {
    console.error(err)
    app.quit()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  stopApiServer()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  stopApiServer()
})
