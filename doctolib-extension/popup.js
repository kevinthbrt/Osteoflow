/*
 * MyOsteoFlow, synchro d’agenda pour Doctolib, fenêtre de l'extension.
 *
 * - vérifie la liaison avec MyOsteoFlow (connexion automatique) ;
 * - « Synchroniser la semaine » : demande au script de la page Doctolib une
 *   synchronisation immédiate ;
 * - « Envoyer un autre jour » : lit ce jour dans la page et l'envoie.
 */
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

function setLink(text, state) {
  $('link').textContent = text
  $('link').dataset.state = state
}

async function activeDoctolibTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab && tab.url && tab.url.startsWith('https://pro.doctolib.fr/') ? tab : null
}

async function checkLink() {
  const reply = await chrome.runtime.sendMessage({ type: 'osteoflow:connect' }).catch(() => null)
  if (reply && reply.ok) {
    setLink('Connecté à MyOsteoFlow', 'ok')
    const { code = '' } = await chrome.storage.local.get('code')
    $('code').value = code
  } else {
    setLink((reply && reply.error) || 'MyOsteoFlow est introuvable : ouvrez l’application.', 'error')
  }
}

async function load() {
  const { code = '', agenda = '', hideButton = false, autoSync = true } = await chrome.storage.local.get(['code', 'agenda', 'hideButton', 'autoSync'])
  $('code').value = code
  $('agenda').value = agenda
  $('showButton').checked = !hideButton
  $('autoSync').checked = autoSync !== false
  $('date').value = today()
  const tab = await activeDoctolibTab()
  if (tab) {
    const reply = await chrome.tabs.sendMessage(tab.id, { type: 'osteoflow:displayed-day' }).catch(() => null)
    if (reply && reply.date) $('date').value = reply.date
    if (reply && reply.lastResult) {
      setStatus(`Synchronisé à ${new Date(reply.lastResult.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`)
    }
  } else {
    setStatus('Ouvrez votre agenda sur pro.doctolib.fr : la semaine se synchronisera toute seule.')
  }
  checkLink()
}

async function send() {
  const button = $('send')
  button.disabled = true
  try {
    const date = $('date').value || today()
    const tab = await activeDoctolibTab()
    if (!tab) throw new Error('Ouvrez votre agenda sur pro.doctolib.fr, puis cliquez à nouveau.')

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

    setStatus('Envoi à MyOsteoFlow…')
    const result = await chrome.runtime.sendMessage({ type: 'osteoflow:sync', start: date, end: date, appointments: reply.appointments })
    if (!result || !result.ok) throw new Error((result && result.error) || 'Envoi impossible.')
    setLink('Connecté à MyOsteoFlow', 'ok')
    setStatus(summary(result), 'ok')
  } catch (error) {
    setStatus(error.message || String(error), 'error')
  } finally {
    button.disabled = false
  }
}

function summary(result) {
  if (!result.received) return 'Aucun rendez-vous patient sur cette période.'
  const parts = [`${result.received} rendez-vous envoyé${result.received > 1 ? 's' : ''}`]
  if (result.added > 0) parts.push(`${result.added} patient${result.added > 1 ? 's' : ''} ajouté${result.added > 1 ? 's' : ''} à Ma journée`)
  if (result.toReview > 0) parts.push(`${result.toReview} à vérifier dans MyOsteoFlow`)
  return `${parts.join(', ')}.`
}

async function syncNow() {
  const button = $('syncNow')
  button.disabled = true
  try {
    const tab = await activeDoctolibTab()
    if (!tab) throw new Error('Ouvrez votre agenda sur pro.doctolib.fr, puis cliquez à nouveau.')
    setStatus('Synchronisation…')
    let result
    try {
      result = await chrome.tabs.sendMessage(tab.id, { type: 'osteoflow:sync-now' })
    } catch (_) {
      throw new Error('Rechargez la page Doctolib (F5), puis réessayez.')
    }
    if (!result || !result.ok) throw new Error((result && result.error) || 'Synchronisation impossible.')
    setLink('Connecté à MyOsteoFlow', 'ok')
    setStatus(summary(result), 'ok')
  } catch (error) {
    setStatus(error.message || String(error), 'error')
  } finally {
    button.disabled = false
  }
}

$('syncNow').addEventListener('click', syncNow)
$('send').addEventListener('click', send)
$('autoSync').addEventListener('change', (event) => {
  chrome.storage.local.set({ autoSync: event.target.checked })
})
$('showButton').addEventListener('change', (event) => {
  chrome.storage.local.set({ hideButton: !event.target.checked })
})
$('save').addEventListener('click', async () => {
  const code = $('code').value.trim().toUpperCase()
  $('code').value = code
  await chrome.storage.local.set({ code, agenda: $('agenda').value.trim() })
  setStatus('Réglages enregistrés.', 'ok')
  checkLink()
})
load()
