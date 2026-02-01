declare module 'electron-updater' {
  interface UpdateInfo {
    version: string
    releaseDate: string
    releaseName?: string
  }

  interface AutoUpdater {
    autoDownload: boolean
    autoInstallOnAppQuit: boolean
    on(event: 'update-available', listener: (info: UpdateInfo) => void): void
    on(event: 'update-downloaded', listener: () => void): void
    on(event: 'error', listener: (error: Error) => void): void
    checkForUpdates(): Promise<unknown>
    downloadUpdate(): Promise<unknown>
    quitAndInstall(): void
  }

  export const autoUpdater: AutoUpdater
}
