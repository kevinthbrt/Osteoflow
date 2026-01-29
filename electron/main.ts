/**
 * Electron main process for Osteoflow desktop application.
 *
 * Responsibilities:
 * - Launch a local Next.js server
 * - Create the application window
 * - Run background cron jobs (follow-up emails, inbox checking)
 * - Handle application lifecycle
 */

import { app, BrowserWindow, shell } from 'electron'
import path from 'path'
import { startCronJobs, stopCronJobs } from './cron'

// Next.js server
let nextServer: any = null
let mainWindow: BrowserWindow | null = null
const PORT = 3456 // Use a non-standard port to avoid conflicts
const isDev = process.env.NODE_ENV === 'development'

/**
 * Start the Next.js server programmatically.
 */
async function startNextServer(): Promise<void> {
  if (isDev) {
    // In development, use next dev
    const { default: next } = await import('next')
    const nextApp = next({
      dev: true,
      dir: path.join(__dirname, '..'),
      port: PORT,
    })
    await nextApp.prepare()
    const handle = nextApp.getRequestHandler()
    const http = await import('http')
    nextServer = http.createServer((req: any, res: any) => handle(req, res))
    await new Promise<void>((resolve) => {
      nextServer.listen(PORT, () => {
        console.log(`[Electron] Next.js dev server running on http://localhost:${PORT}`)
        resolve()
      })
    })
  } else {
    // In production, use the standalone Next.js server
    const { default: next } = await import('next')
    const nextApp = next({
      dev: false,
      dir: path.join(__dirname, '..'),
      port: PORT,
    })
    await nextApp.prepare()
    const handle = nextApp.getRequestHandler()
    const http = await import('http')
    nextServer = http.createServer((req: any, res: any) => handle(req, res))
    await new Promise<void>((resolve) => {
      nextServer.listen(PORT, () => {
        console.log(`[Electron] Next.js server running on http://localhost:${PORT}`)
        resolve()
      })
    })
  }
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
    // macOS specific
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 16, y: 16 },
    // Windows specific
    autoHideMenuBar: true,
    show: false,
  })

  // Show window when ready to avoid flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // Load the Next.js app
  mainWindow.loadURL(`http://localhost:${PORT}`)

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://localhost')) {
      return { action: 'allow' }
    }
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Open DevTools in development
  if (isDev) {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

/**
 * Application lifecycle.
 */
app.whenReady().then(async () => {
  console.log('[Electron] Starting Osteoflow...')

  try {
    // Start Next.js server
    await startNextServer()

    // Create the window
    createWindow()

    // Start background cron jobs
    startCronJobs(PORT)

    console.log('[Electron] Osteoflow ready!')
  } catch (error) {
    console.error('[Electron] Failed to start:', error)
    app.quit()
  }

  // macOS: re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Cleanup on quit
app.on('before-quit', () => {
  console.log('[Electron] Shutting down...')
  stopCronJobs()
  if (nextServer) {
    nextServer.close()
  }
})
