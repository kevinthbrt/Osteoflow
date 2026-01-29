/**
 * Electron preload script.
 *
 * This script runs in the renderer process before the page loads.
 * It provides a bridge between the renderer and main process via contextBridge.
 * Currently minimal since the app uses Next.js API routes for all server operations.
 */

import { contextBridge } from 'electron'

// Expose a minimal API to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  platform: process.platform,
})
