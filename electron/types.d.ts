declare module 'electron-updater' {
  interface UpdateInfo {
    version: string
    releaseDate: string
    releaseName?: string
    releaseNotes?: string | { version: string; note: string }[]
  }

  interface ProgressInfo {
    percent: number
    bytesPerSecond: number
    total: number
    transferred: number
  }

  interface AutoUpdater {
    autoDownload: boolean
    autoInstallOnAppQuit: boolean
    on(event: 'update-available', listener: (info: UpdateInfo) => void): void
    on(event: 'update-not-available', listener: (info: UpdateInfo) => void): void
    on(event: 'download-progress', listener: (progress: ProgressInfo) => void): void
    on(event: 'update-downloaded', listener: (info: UpdateInfo) => void): void
    on(event: 'error', listener: (error: Error) => void): void
    checkForUpdates(): Promise<unknown>
    downloadUpdate(): Promise<unknown>
    quitAndInstall(): void
  }

  export const autoUpdater: AutoUpdater
}
