/*
 * Osteoflow : import Doctolib, fenêtre de l'extension.
 *
 * 1. demande au script de la page Doctolib les rendez-vous du jour choisi ;
 * 2. trouve Osteoflow sur le poste (ports 3456 à 3465) ;
 * 3. lui envoie les rendez-vous avec le code d'appairage.
 */
const PORTS = Array.from({ length: 10 }, (_, index) => 3456 + index)
const HOSTS = ['localhost', '127.0.0.1']

const $ = (id) => document.getElementById(id)

function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function setStatus(text, kind) {
  const status = $('status')
  status.textContent = text
  status.className = kind || ''
}

async function loadSettings() {
  const { code = '', agenda = '' } = await chrome.storage.local.get(['code', 'agenda'])
  $('code').value = code
  $('agenda').value = agenda
  $('date').value = today()
  if (!code) $('settings').open = true
}

async function findOsteoflow() {
  for (const port of PORTS) {
    for (const host of HOSTS) {
      const base = `http://${host}:${port}`
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 700)
        const response = await fetch(`${base}/api/doctolib/ping`, { signal: controller.signal })
        clearTimeout(timer)
        if (response.ok && (await response.json()).app === 'myosteoflow') return base
      } catch (_) {
        // Port suivant
      }
    }
  }
  return null
}

async function send() {
  const button = $('send')
  button.disabled = true
  try {
    const code = $('code').value.trim()
    if (!code) {
      $('settings').open = true
      throw new Error('Saisissez d’abord le code d’appairage (Réglages).')
    }
    const date = $('date').value || today()

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab || !tab.url || !tab.url.startsWith('https://pro.doctolib.fr/')) {
      throw new Error('Ouvrez votre agenda sur pro.doctolib.fr, puis cliquez à nouveau.')
    }

    setStatus('Lecture de l’agenda Doctolib…')
    let reply
    try {
      reply = await chrome.tabs.sendMessage(tab.id, {
        type: 'osteoflow:fetch-day',
        date,
        agendaIds: $('agenda').value.trim() || null,
      })
    } catch (_) {
      throw new Error('Rechargez la page Doctolib (F5), puis réessayez.')
    }
    if (!reply || !reply.ok) throw new Error((reply && reply.error) || 'Lecture de l’agenda impossible.')
    if (reply.agendaIds && !$('agenda').value.trim()) {
      await chrome.storage.local.set({ detectedAgenda: reply.agendaIds })
    }

    setStatus('Recherche d’Osteoflow sur ce poste…')
    const base = await findOsteoflow()
    if (!base) throw new Error('Osteoflow est introuvable : ouvrez l’application, puis réessayez.')

    const response = await fetch(`${base}/api/doctolib/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-osteoflow-token': code },
      body: JSON.stringify({ date, appointments: reply.appointments }),
    })
    if (response.status === 401) {
      $('settings').open = true
      throw new Error('Code d’appairage refusé : recopiez-le depuis Osteoflow.')
    }
    if (!response.ok) throw new Error(`Osteoflow a répondu ${response.status}.`)
    const { count } = await response.json()
    setStatus(
      count === 0
        ? 'Aucun rendez-vous patient ce jour-là.'
        : `${count} rendez-vous envoyé${count > 1 ? 's' : ''}. Validez-les dans Osteoflow, Ma journée.`,
      'ok'
    )
  } catch (error) {
    setStatus(error.message || String(error), 'error')
  } finally {
    button.disabled = false
  }
}

$('send').addEventListener('click', send)
$('save').addEventListener('click', async () => {
  await chrome.storage.local.set({ code: $('code').value.trim().toUpperCase(), agenda: $('agenda').value.trim() })
  $('code').value = $('code').value.trim().toUpperCase()
  setStatus('Réglages enregistrés.', 'ok')
})
loadSettings()
