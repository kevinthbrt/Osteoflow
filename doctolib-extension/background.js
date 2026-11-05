/*
 * MyOsteoFlow, synchro d’agenda pour Doctolib, service de l'extension.
 *
 * Seul endroit qui parle à MyOsteoFlow sur le poste :
 * - le trouve (ports 3456 à 3465, en commençant par le dernier utilisé) ;
 * - se connecte tout seul : le code d'appairage est demandé à MyOsteoFlow
 *   lui-même, sans copier-coller. Un site web ne peut pas faire cette
 *   demande (MyOsteoFlow n'autorise aucun autre site), l'extension si, grâce à
 *   son autorisation sur localhost ;
 * - envoie les rendez-vous lus dans la page Doctolib (synchronisation de la
 *   semaine, automatique ou à la demande).
 */
const PORTS = Array.from({ length: 10 }, (_, index) => 3456 + index)
const HOSTS = ['localhost', '127.0.0.1']
const VERSION = chrome.runtime.getManifest().version

async function isOsteoflow(base) {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 700)
    const response = await fetch(`${base}/api/doctolib/ping`, { signal: controller.signal })
    clearTimeout(timer)
    return response.ok && (await response.json()).app === 'myosteoflow'
  } catch (_) {
    return false
  }
}

async function findOsteoflow() {
  const { base } = await chrome.storage.local.get('base')
  if (base && (await isOsteoflow(base))) return base
  for (const port of PORTS) {
    for (const host of HOSTS) {
      const candidate = `http://${host}:${port}`
      if (candidate !== base && (await isOsteoflow(candidate))) {
        await chrome.storage.local.set({ base: candidate })
        return candidate
      }
    }
  }
  return null
}

/** Demande le code à MyOsteoFlow et le garde. */
async function pair(base) {
  const response = await fetch(`${base}/api/doctolib/pairing`, { headers: { 'x-osteoflow-app': '1' } })
  if (!response.ok) return null
  const { code } = await response.json()
  if (!code) return null
  await chrome.storage.local.set({ code })
  return code
}

async function hello(base, code) {
  return fetch(`${base}/api/doctolib/hello`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-osteoflow-token': code },
    body: JSON.stringify({ version: VERSION }),
  })
}

/**
 * Vérifie la liaison avec MyOsteoFlow et la rétablit si besoin (nouveau code
 * généré dans MyOsteoFlow, autre poste…). Renvoie { base, code } ou une erreur.
 */
async function connect() {
  const base = await findOsteoflow()
  if (!base) return { ok: false, error: 'MyOsteoFlow est introuvable : ouvrez l’application, puis réessayez.' }
  let { code } = await chrome.storage.local.get('code')
  if (code) {
    const response = await hello(base, code).catch(() => null)
    if (response && response.ok) return { ok: true, base, code }
  }
  code = await pair(base).catch(() => null)
  if (!code) return { ok: false, error: 'Connexion à MyOsteoFlow impossible : saisissez le code dans les Réglages.' }
  const response = await hello(base, code).catch(() => null)
  if (!response || !response.ok) return { ok: false, error: 'MyOsteoFlow a refusé la connexion.' }
  return { ok: true, base, code }
}

/** Rendez-vous des jours `start` à `end`, lus dans la page Doctolib. */
async function syncRange({ start, end, appointments }) {
  const link = await connect()
  if (!link.ok) return link
  const response = await fetch(`${link.base}/api/doctolib/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-osteoflow-token': link.code },
    body: JSON.stringify({ start, end, appointments, version: VERSION }),
  })
  if (!response.ok) return { ok: false, error: `MyOsteoFlow a répondu ${response.status}.` }
  return response.json()
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== 'string') return false
  const run = {
    'osteoflow:connect': () => connect(),
    'osteoflow:sync': () => syncRange(message),
  }[message.type]
  if (!run) return false
  run()
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }))
  return true // réponse asynchrone
})

// Dès l'installation : connexion à MyOsteoFlow s'il est ouvert, pour que
// l'application affiche aussitôt « Extension connectée ».
chrome.runtime.onInstalled.addListener(() => {
  connect().catch(() => {})
})
chrome.runtime.onStartup.addListener(() => {
  connect().catch(() => {})
})
