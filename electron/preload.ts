/**
 * Electron preload script.
 *
 * This script runs in the renderer process before the page loads.
 * It provides a bridge between the renderer and main process via contextBridge.
 * Exposes IPC events so the React app can react to main-process events.
 */

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  platform: process.platform,

  // Auto-update events
  onUpdateAvailable: (callback: (version: string) => void) => {
    ipcRenderer.on('update-available', (_event, version: string) => callback(version))
  },
  onUpdateProgress: (callback: (percent: number) => void) => {
    ipcRenderer.on('update-progress', (_event, percent: number) => callback(percent))
  },
  onUpdateDownloaded: (callback: (version: string) => void) => {
    ipcRenderer.on('update-downloaded', (_event, version: string) => callback(version))
  },
  installUpdate: () => {
    ipcRenderer.send('install-update')
  },

  // Survey sync events
  onSurveySynced: (callback: (count: number) => void) => {
    ipcRenderer.on('survey-synced', (_event, count: number) => callback(count))
  },

  // Inbox sync events
  onInboxSynced: (callback: (count: number) => void) => {
    ipcRenderer.on('inbox-synced', (_event, count: number) => callback(count))
  },

  // License expiry event
  // Fired by the 30-minute heartbeat when the Osteoupgrade subscription
  // is no longer active or a concurrent session is detected.
  onLicenseExpired: (callback: (payload: { message: string; code: string }) => void) => {
    ipcRenderer.on('license-expired', (_event, payload) => callback(payload))
  },
})
