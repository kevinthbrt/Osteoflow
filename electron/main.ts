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

import { app, BrowserWindow, shell, dialog } from 'electron'
import path from 'path'
import { startCronJobs, stopCronJobs } from './cron'

// Next.js server
let nextServer: any = null
let mainWindow: BrowserWindow | null = null
const PORT = 3456
const isDev = process.env.NODE_ENV === 'development'

/**
 * Start the Next.js server programmatically.
 */
async function startNextServer(): Promise<void> {
  const http = await import('http')

  if (isDev) {
    // Development: use the full next() API for hot reload
    const { default: next } = await import('next')
    const nextApp = next({
      dev: true,
      dir: path.join(__dirname, '..'),
      port: PORT,
    })
    await nextApp.prepare()
    const handle = nextApp.getRequestHandler()
    nextServer = http.createServer((req: any, res: any) => handle(req, res))
  } else {
    // Production: use NextServer directly (avoids spawning npm/npx)
    const appDir = path.join(__dirname, '..')

    // Ensure NODE_ENV is set and CWD points to the app root so Next.js
    // can resolve assets correctly in the packaged app.
    ;(process.env as any).NODE_ENV = 'production'
    process.chdir(appDir)

    const fs = await import('fs')
    const configPath = path.join(appDir, '.next', 'required-server-files.json')
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
      dir: appDir,
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
        const filePath = path.join(appDir, '.next', 'static', relativePath)
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

  await new Promise<void>((resolve) => {
    nextServer.listen(PORT, () => {
      console.log(`[Electron] Next.js server running on http://localhost:${PORT}`)
      resolve()
    })
  })
}

/**
 * Create the main application window.
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Osteoflow',
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

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.loadURL(`http://localhost:${PORT}`)

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
 * Auto-updater: checks GitHub Releases for new versions.
 * Only runs in production (packaged app).
 */
async function setupAutoUpdater(): Promise<void> {
  if (isDev) return

  try {
    const { autoUpdater } = await import('electron-updater')

    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('update-available', (info) => {
      console.log(`[Updater] Update available: v${info.version}`)
      dialog
        .showMessageBox({
          type: 'info',
          title: 'Mise à jour disponible',
          message: `La version ${info.version} d'Osteoflow est disponible.`,
          detail: 'Voulez-vous la télécharger maintenant ?',
          buttons: ['Télécharger', 'Plus tard'],
          defaultId: 0,
        })
        .then(({ response }) => {
          if (response === 0) {
            autoUpdater.downloadUpdate()
          }
        })
    })

    autoUpdater.on('update-downloaded', () => {
      console.log('[Updater] Update downloaded')
      dialog
        .showMessageBox({
          type: 'info',
          title: 'Mise à jour prête',
          message: 'La mise à jour a été téléchargée.',
          detail: "L'application va redémarrer pour appliquer la mise à jour.",
          buttons: ['Redémarrer maintenant', 'Plus tard'],
          defaultId: 0,
        })
        .then(({ response }) => {
          if (response === 0) {
            autoUpdater.quitAndInstall()
          }
        })
    })

    autoUpdater.on('error', (error) => {
      console.error('[Updater] Error:', error.message)
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

  try {
    await startNextServer()
    createWindow()
    startCronJobs(PORT)
    setupAutoUpdater()

    console.log('[Electron] Osteoflow ready!')
  } catch (error) {
    console.error('[Electron] Failed to start:', error)
    app.quit()
  }

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
