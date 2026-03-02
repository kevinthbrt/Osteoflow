/**
 * Electron main process for Osteoflow desktop application.
 *
 * Responsibilities:
 * - Launch a local Next.js server
 * - Create the application window
 * - Run background cron jobs (follow-up emails, inbox checking)
 * - Handle auto-updates via GitHub Releases
 * - Handle application lifecycle
 */

import { app, BrowserWindow, shell, dialog, Notification, ipcMain } from 'electron'
import path from 'path'
import { startCronJobs, stopCronJobs } from './cron'

// Polyfill diagnostics_channel.tracingChannel for Node.js 18 (Electron 28).
// nodemailer v7+ requires this API which was added in Node.js 20.
// Without this polyfill, any email-related API call crashes with:
//   "diagChan.tracingChannel is not a function"
{
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dc = require('diagnostics_channel')
  if (typeof dc.tracingChannel !== 'function') {
    const noop = () => {}
    const noopChannel = {
      subscribe: noop, unsubscribe: noop, publish: noop,
      hasSubscribers: false, bindStore: noop, unbindStore: noop,
    }
    dc.tracingChannel = () => ({
      start: { ...noopChannel },
      end: { ...noopChannel },
      asyncStart: { ...noopChannel },
      asyncEnd: { ...noopChannel },
      error: { ...noopChannel },
      subscribe: noop,
      unsubscribe: noop,
      traceSync: (fn: any, _ctx: any, thisArg: any, ...args: any[]) => fn.apply(thisArg, args),
      tracePromise: (fn: any, _ctx: any, thisArg: any, ...args: any[]) => fn.apply(thisArg, args),
      traceCallback: (fn: any, _pos: any, _ctx: any, thisArg: any, ...args: any[]) => fn.apply(thisArg, args),
    })
    console.log('[Electron] Installed diagnostics_channel.tracingChannel polyfill')
  }
}

// Next.js server
let nextServer: any = null
let mainWindow: BrowserWindow | null = null
const PORT = 3456
const isDev = !app.isPackaged

/**
 * Wait for a local HTTP server to respond on the given port.
 * Polls every `interval` ms, up to `timeout` ms total.
 */
async function waitForServer(port: number, timeout = 120000, interval = 500): Promise<void> {
  const http = await import('http')
  const start = Date.now()

  while (Date.now() - start < timeout) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.get(`http://localhost:${port}/`, (res) => {
          res.resume()
          resolve()
        })
        req.on('error', reject)
        req.setTimeout(1000, () => {
          req.destroy()
          reject(new Error('timeout'))
        })
      })
      return // Server is ready
    } catch {
      await new Promise((r) => setTimeout(r, interval))
    }
  }

  throw new Error(`Server on port ${port} did not respond within ${timeout}ms`)
}

/**
 * Start the Next.js server programmatically.
 */
async function startNextServer(): Promise<void> {
  const http = await import('http')

  // In dev mode (launched via concurrently), the Next.js dev server is already
  // running on the port. Wait for it to be ready before proceeding.
  if (isDev) {
    console.log('[Electron] Dev mode — waiting for dev server on port', PORT)
    await waitForServer(PORT)
    console.log('[Electron] Dev server is ready')
    return
  }

  {
    // Production: use NextServer directly (avoids spawning npm/npx)
    const appDir = path.join(__dirname, '..')

    // Ensure NODE_ENV is set and CWD points to the app root so Next.js
    // can resolve assets correctly in the packaged app.
    // With asar enabled, .next/ is unpacked to app.asar.unpacked/ — use
    // that real directory for chdir since the OS can't chdir into an asar file.
    ;(process.env as any).NODE_ENV = 'production'
    const realDir = appDir.endsWith('.asar')
      ? appDir + '.unpacked'
      : appDir
    process.chdir(realDir)

    // Register the app's node_modules in Node.js module resolution paths.
    // Next.js serverExternalPackages (better-sqlite3) are loaded via require()
    // from compiled code in .next/server/. Without this, Node.js may not walk
    // up far enough to find node_modules at the app root.
    const nodeModulesPath = path.join(appDir, 'node_modules')
    process.env.NODE_PATH = [
      nodeModulesPath,
      process.env.NODE_PATH,
    ].filter(Boolean).join(path.delimiter)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Module = require('module')
    Module.Module._initPaths()

    // Patch Node.js module resolution to handle Turbopack's hashed external
    // module names. Turbopack (Next.js 16) appends a hash to external module
    // names in compiled output (e.g., "better-sqlite3-90e2652d1716b047" instead
    // of "better-sqlite3"). This patch strips the hash on resolution failure
    // and retries with the original module name.
    const originalResolve = Module.Module._resolveFilename
    Module.Module._resolveFilename = function(request: string, ...args: unknown[]) {
      try {
        return originalResolve.call(this, request, ...args)
      } catch (err: unknown) {
        const stripped = request.replace(/-[a-f0-9]{16,}$/, '')
        if (stripped !== request) {
          return originalResolve.call(this, stripped, ...args)
        }
        throw err
      }
    }

    const fs = await import('fs')
    const configPath = path.join(realDir, '.next', 'required-server-files.json')
    const requiredServerFiles = JSON.parse(fs.readFileSync(configPath, 'utf8'))

    const conf = {
      ...requiredServerFiles.config,
      distDir: '.next',
      customServer: true,
    }

    const NextServer = require('next/dist/server/next-server').default
    const nextApp = new NextServer({
      hostname: 'localhost',
      port: PORT,
      dir: realDir,
      dev: false,
      conf,
    })

    const handle = nextApp.getRequestHandler()

    // MIME types for static file serving
    const MIME_TYPES: Record<string, string> = {
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.map': 'application/json',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.eot': 'application/vnd.ms-fontobject',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.gif': 'image/gif',
      '.ico': 'image/x-icon',
      '.webp': 'image/webp',
      '.txt': 'text/plain',
    }

    nextServer = http.createServer(async (req: any, res: any) => {
      const reqUrl = req.url || '/'

      // Serve /_next/static/* files directly from .next/static/ on disk.
      // This bypasses NextServer's internal path resolution which can fail
      // in packaged Electron apps.
      if (reqUrl.startsWith('/_next/static/')) {
        const relativePath = reqUrl.replace('/_next/static/', '').split('?')[0]
        const filePath = path.join(realDir, '.next', 'static', relativePath)
        try {
          const data = fs.readFileSync(filePath)
          const ext = path.extname(filePath)
          res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream')
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
          res.end(data)
          return
        } catch {
          // File not found, fall through to NextServer
        }
      }

      try {
        await handle(req, res)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.error('[NextServer] Request error:', message)
        res.statusCode = 500
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ error: message }))
      }
    })
  }

  await new Promise<void>((resolve, reject) => {
    nextServer.on('error', (err: NodeJS.ErrnoException) => {
      reject(err)
    })
    nextServer.listen(PORT, () => {
      console.log(`[Electron] Next.js server running on http://localhost:${PORT}`)
      resolve()
    })
  })
}

/**
 * Inline splash screen shown instantly while Next.js boots.
 */
const SPLASH_HTML = `data:text/html;charset=utf-8,${encodeURIComponent(`<!DOCTYPE html>
<html><head><style>
  body { margin:0; height:100vh; display:flex; align-items:center; justify-content:center;
         background:#f8fafc; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; color:#334155; }
  .c { text-align:center; }
  h1 { font-size:28px; font-weight:600; margin-bottom:12px; }
  p { font-size:14px; color:#94a3b8; margin-bottom:24px; }
  .spinner { width:32px; height:32px; border:3px solid #e2e8f0; border-top-color:#6366f1;
             border-radius:50%; animation:spin .8s linear infinite; margin:0 auto; }
  @keyframes spin { to { transform:rotate(360deg) } }
</style></head><body><div class="c">
  <h1>Osteoflow</h1><p>Chargement en cours…</p><div class="spinner"></div>
</div></body></html>`)}`

/**
 * Create the main application window.
 * Shows a splash screen immediately, then navigates to Next.js once ready.
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Osteoflow',
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 16 },
    autoHideMenuBar: true,
    show: false,
  })

  // Show splash screen instantly
  mainWindow.loadURL(SPLASH_HTML)
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://localhost')) {
      return { action: 'allow' }
    }
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

/**
 * Navigate the main window to the Next.js app once the server is ready.
 * Retries on failure (e.g. server not fully ready yet).
 */
function loadApp(retries = 5): void {
  if (!mainWindow) return

  const url = `http://localhost:${PORT}`
  mainWindow.loadURL(url)

  // Retry on load failure (server might not be fully ready)
  mainWindow.webContents.once('did-fail-load', (_event, errorCode, errorDescription) => {
    if (retries > 0) {
      console.log(`[Electron] Page load failed (${errorDescription}), retrying... (${retries} left)`)
      setTimeout(() => loadApp(retries - 1), 1500)
    } else {
      console.error(`[Electron] Failed to load app after retries: ${errorDescription} (code ${errorCode})`)
    }
  })
}

/**
 * Auto-updater: checks GitHub Releases for new versions.
 * Only runs in production (packaged app).
 *
 * Sends IPC events to the renderer so the React app can display
 * in-app update notifications (banner, progress, restart button).
 */
async function setupAutoUpdater(): Promise<void> {
  if (isDev) return

  try {
    const { autoUpdater } = await import('electron-updater')

    // Silent background download — no interruption during work
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('update-available', (info) => {
      console.log(`[Updater] Update available: v${info.version} — downloading silently...`)
      mainWindow?.webContents.send('update-available', info.version)
    })

    autoUpdater.on('download-progress', (progress) => {
      const percent = Math.round(progress.percent)
      console.log(`[Updater] Download progress: ${percent}%`)
      mainWindow?.webContents.send('update-progress', percent)
    })

    autoUpdater.on('update-downloaded', (info) => {
      console.log(`[Updater] Update v${info.version} downloaded — ready to install`)
      mainWindow?.webContents.send('update-downloaded', info.version)
    })

    autoUpdater.on('error', (error) => {
      console.error('[Updater] Error:', error.message)
    })

    // Listen for restart request from the renderer
    ipcMain.on('install-update', () => {
      console.log('[Updater] Install requested by user — quitting and installing...')
      autoUpdater.quitAndInstall()
    })

    // Check for updates 5s after launch, then every 4 hours
    setTimeout(() => autoUpdater.checkForUpdates(), 5000)
    setInterval(() => autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1000)
  } catch (error) {
    console.error('[Updater] Failed to initialize:', error)
  }
}

/**
 * Application lifecycle.
 */
app.whenReady().then(async () => {
  console.log('[Electron] Starting Osteoflow...')

  // Show window with splash screen immediately — no waiting
  createWindow()

  try {
    await startNextServer()
  } catch (error: any) {
    if (isDev && error?.code === 'EADDRINUSE') {
      console.log('[Electron] Port', PORT, 'already in use — connecting to existing dev server')
    } else {
      console.error('[Electron] Failed to start:', error)
      app.quit()
      return
    }
  }

  loadApp() // Navigate from splash to the real app
  startCronJobs(PORT)
  setupAutoUpdater()

  console.log('[Electron] Osteoflow ready!')

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  console.log('[Electron] Shutting down...')
  stopCronJobs()
  if (nextServer) {
    nextServer.close()
  }
})
