/*
 * Osteoflow : import Doctolib, script de page (pro.doctolib.fr uniquement).
 *
 * Il ne fait rien tout seul. Quand on clique sur « Envoyer à Osteoflow »
 * dans l'extension, il lit les rendez-vous du jour demandé avec la session
 * Doctolib déjà ouverte, garde seulement les champs utiles et les rend à
 * l'extension. Aucune donnée n'est envoyée ailleurs que vers Osteoflow sur
 * ce poste.
 */
(() => {
  const AGENDA_PATTERN = /\/calendar_display\/[a-z_]+\?[^#]*?agenda_ids=([0-9,%2C]+)/i
  let detectedAgendaIds = null

  const remember = (url) => {
    const match = typeof url === 'string' && url.match(AGENDA_PATTERN)
    if (match) detectedAgendaIds = decodeURIComponent(match[1])
  }

  // L'agenda affiché demande lui-même ses rendez-vous : on note l'identifiant
  // d'agenda utilisé, sans lire la réponse.
  try {
    performance.getEntriesByType('resource').forEach((entry) => remember(entry.name))
    new PerformanceObserver((list) => list.getEntries().forEach((entry) => remember(entry.name)))
      .observe({ type: 'resource', buffered: true })
  } catch (_) {
    // Navigateur sans PerformanceObserver : réglage manuel dans l'extension.
  }

  const pick = (appointment) => ({
    id: appointment.id,
    type: appointment.type,
    status: appointment.status,
    start_date: appointment.start_date,
    end_date: appointment.end_date,
    patient: appointment.patient
      ? {
          first_name: appointment.patient.first_name,
          last_name: appointment.patient.last_name,
          maiden_name: appointment.patient.maiden_name,
          birthdate: appointment.patient.birthdate,
          biological_sex: appointment.patient.biological_sex,
          phone_number: appointment.patient.phone_number,
          email: appointment.patient.email,
        }
      : null,
  })

  async function fetchDay(date, agendaIds) {
    const params = new URLSearchParams({
      agenda_ids: agendaIds,
      start_date: `${date} 00:00:00`,
      end_date: `${date} 23:59:59`,
      view: 'day',
    })
    const response = await fetch(`/calendar_display/appointments?${params}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
    if (response.status === 401 || response.status === 403) {
      throw new Error('Session Doctolib expirée : reconnectez-vous puis réessayez.')
    }
    if (!response.ok) throw new Error(`Doctolib a répondu ${response.status}.`)
    const body = await response.json()
    const list = Array.isArray(body) ? body : Array.isArray(body && body.data) ? body.data : null
    if (!list) throw new Error('Réponse Doctolib inattendue : l’agenda a peut-être changé de format.')
    return list.map(pick)
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== 'osteoflow:fetch-day') return false
    const agendaIds = (message.agendaIds || detectedAgendaIds || '').trim()
    if (!agendaIds) {
      sendResponse({
        ok: false,
        error: 'Agenda introuvable : affichez votre agenda Doctolib (vue jour ou semaine), puis réessayez.',
      })
      return false
    }
    fetchDay(message.date, agendaIds)
      .then((appointments) => sendResponse({ ok: true, appointments, agendaIds }))
      .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }))
    return true // réponse asynchrone
  })
})()
