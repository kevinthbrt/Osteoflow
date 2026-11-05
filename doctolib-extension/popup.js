/*
 * Osteoflow : import Doctolib, fenêtre de l'extension.
 *
 * 1. vérifie la liaison avec Osteoflow (connexion automatique) ;
 * 2. demande au script de la page Doctolib les rendez-vous du jour choisi ;
 * 3. les confie au service de l'extension, qui les envoie à Osteoflow.
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
    setLink('Connecté à Osteoflow', 'ok')
    const { code = '' } = await chrome.storage.local.get('code')
    $('code').value = code
  } else {
    setLink((reply && reply.error) || 'Osteoflow est introuvable : ouvrez l’application.', 'error')
  }
}

async function load() {
  const { code = '', agenda = '', hideButton = false } = await chrome.storage.local.get(['code', 'agenda', 'hideButton'])
  $('code').value = code
  $('agenda').value = agenda
  $('showButton').checked = !hideButton
  $('date').value = today()
  const tab = await activeDoctolibTab()
  if (tab) {
    const reply = await chrome.tabs.sendMessage(tab.id, { type: 'osteoflow:displayed-day' }).catch(() => null)
    if (reply && reply.date) $('date').value = reply.date
  } else {
    setStatus('Ouvrez votre agenda sur pro.doctolib.fr pour envoyer vos rendez-vous.')
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

    setStatus('Envoi à Osteoflow…')
    const result = await chrome.runtime.sendMessage({ type: 'osteoflow:post', date, appointments: reply.appointments })
    if (!result || !result.ok) throw new Error((result && result.error) || 'Envoi impossible.')
    setLink('Connecté à Osteoflow', 'ok')
    setStatus(
      result.count === 0
        ? 'Aucun rendez-vous patient ce jour-là.'
        : `${result.count} rendez-vous envoyé${result.count > 1 ? 's' : ''}. Validez-les dans Osteoflow, Ma journée.`,
      'ok'
    )
  } catch (error) {
    setStatus(error.message || String(error), 'error')
  } finally {
    button.disabled = false
  }
}

$('send').addEventListener('click', send)
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
