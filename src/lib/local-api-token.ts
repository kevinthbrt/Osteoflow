/**
 * Client-side helper for the local API token.
 *
 * The embedded HTTP server (electron/main.ts) requires this token on every
 * sensitive route to prove a request actually comes from this app's own
 * renderer, not another local process or a malicious webpage the user
 * happens to have open while MyOsteoFlow is running. Fetched once via IPC
 * and cached in memory for the lifetime of the page.
 */

export const LOCAL_API_TOKEN_HEADER = 'x-local-api-token'

interface ElectronAPIWithToken {
  getLocalApiToken?: () => Promise<string>
}

function getElectronAPI(): ElectronAPIWithToken | undefined {
  if (typeof window === 'undefined') return undefined
  return (window as unknown as { electronAPI?: ElectronAPIWithToken }).electronAPI
}

let cachedToken: Promise<string | null> | null = null

async function getLocalApiToken(): Promise<string | null> {
  if (!cachedToken) {
    const api = getElectronAPI()
    cachedToken = api?.getLocalApiToken ? api.getLocalApiToken().catch(() => null) : Promise.resolve(null)
  }
  return cachedToken
}

/**
 * Headers to attach to any fetch() call targeting a sensitive local API
 * route (/api/db, uploads, database backup/restore).
 */
export async function localApiHeaders(): Promise<Record<string, string>> {
  const token = await getLocalApiToken()
  return token ? { [LOCAL_API_TOKEN_HEADER]: token } : {}
}
