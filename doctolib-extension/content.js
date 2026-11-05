/*
 * Osteoflow : import Doctolib, script de page (pro.doctolib.fr uniquement).
 *
 * Il ne fait rien tout seul. Il affiche, une fois l'agenda chargé, un petit
 * bouton « Envoyer à Osteoflow ». Au clic (sur ce bouton ou dans la fenêtre de
 * l'extension), il lit les rendez-vous du jour avec la session Doctolib déjà
 * ouverte, garde seulement les champs utiles et les passe à l'extension, qui
 * les envoie à Osteoflow sur ce poste. Aucune donnée ne part ailleurs.
 */
(() => {
  const AGENDA_PATTERN = /\/calendar_display\/[a-z_]+\?[^#]*?agenda_ids=([0-9,%2C]+)/i
  const DAY_PATTERN = /[?&]start_date=(\d{4}-\d{2}-\d{2})[^&#]*&(?:[^#]*&)?end_date=(\d{4}-\d{2}-\d{2})/
  let detectedAgendaIds = null
  /** Jour affiché quand l'agenda est en vue jour, sinon null (aujourd'hui) */
  let displayedDay = null

  const remember = (url) => {
    const match = typeof url === 'string' && url.match(AGENDA_PATTERN)
    if (!match) return
    detectedAgendaIds = decodeURIComponent(match[1])
    const range = url.match(DAY_PATTERN)
    displayedDay = range && range[1] === range[2] ? range[1] : null
    if (window.top === window) showButton()
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

  // ── Bouton « Envoyer à Osteoflow » dans la page ──
  const today = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const dayLabel = (date) =>
    date === today()
      ? 'aujourd’hui'
      : `le ${new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00`))}`

  let host = null
  let label = null
  let state = 'idle'

  function render(text) {
    if (!label) return
    label.textContent = text || `Envoyer ${dayLabel(displayedDay || today())} à Osteoflow`
  }

  async function sendFromButton() {
    if (state === 'busy') return
    state = 'busy'
    host.dataset.state = 'busy'
    const date = displayedDay || today()
    render('Envoi en cours…')
    try {
      if (!detectedAgendaIds) throw new Error('Affichez votre agenda, puis réessayez.')
      const appointments = await fetchDay(date, detectedAgendaIds)
      const reply = await chrome.runtime.sendMessage({ type: 'osteoflow:post', date, appointments })
      if (!reply || !reply.ok) throw new Error((reply && reply.error) || 'Envoi impossible.')
      host.dataset.state = 'ok'
      render(reply.count === 0
        ? 'Aucun rendez-vous patient ce jour-là'
        : `${reply.count} rendez-vous envoyé${reply.count > 1 ? 's' : ''} à Osteoflow ✓`)
    } catch (error) {
      host.dataset.state = 'error'
      render(error.message || String(error))
    }
    state = 'done'
    setTimeout(() => {
      state = 'idle'
      if (host) host.dataset.state = 'idle'
      render()
    }, 6000)
  }

  async function showButton() {
    if (host) {
      if (state === 'idle') render()
      return
    }
    host = document.createElement('div')
    host.id = 'osteoflow-send'
    const { hideButton } = await chrome.storage.local.get('hideButton').catch(() => ({}))
    if (hideButton) return
    const root = host.attachShadow({ mode: 'closed' })
    root.innerHTML = `
      <style>
        :host { all: initial; position: fixed; right: 20px; bottom: 20px; z-index: 2147483000; }
        .pill { display: flex; align-items: center; gap: 2px; padding: 4px; border-radius: 999px; background: #fff;
          box-shadow: 0 6px 24px rgba(16,24,40,.18), 0 0 0 1px rgba(16,24,40,.08); font: 600 13px/1 Inter, system-ui, -apple-system, "Segoe UI", sans-serif; }
        button { all: unset; cursor: pointer; display: flex; align-items: center; gap: 8px; border-radius: 999px; }
        .send { padding: 8px 14px 8px 8px; background: #2f5fe8; color: #fff; max-width: 340px; }
        .send:hover { background: #2549c4; }
        .send img { width: 20px; height: 20px; border-radius: 5px; background: #fff; }
        .close { width: 26px; height: 26px; justify-content: center; color: #667085; font-size: 16px; }
        .close:hover { background: #f2f4f7; color: #101828; }
        :host([data-state="busy"]) .send { opacity: .8; cursor: progress; }
        :host([data-state="ok"]) .send { background: #067647; }
        :host([data-state="error"]) .send { background: #b42318; }
        span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      </style>
      <div class="pill">
        <button class="send" type="button" title="Envoie les rendez-vous du jour affiché à Osteoflow, sur ce poste">
          <img alt="" src="${chrome.runtime.getURL('icons/icon-32.png')}"><span></span>
        </button>
        <button class="close" type="button" title="Masquer ce bouton (il reste disponible via l’icône de l’extension)" aria-label="Masquer">×</button>
      </div>`
    label = root.querySelector('span')
    root.querySelector('.send').addEventListener('click', sendFromButton)
    root.querySelector('.close').addEventListener('click', () => {
      chrome.storage.local.set({ hideButton: true })
      host.remove()
    })
    render()
    const attach = () => document.body.appendChild(host)
    if (document.body) attach()
    else document.addEventListener('DOMContentLoaded', attach, { once: true })
  }

  chrome.storage.onChanged.addListener((changes) => {
    if (!changes.hideButton) return
    if (changes.hideButton.newValue) {
      if (host) host.remove()
      host = null
      label = null
    } else if (detectedAgendaIds && window.top === window) {
      host = null
      showButton()
    }
  })

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message && message.type === 'osteoflow:displayed-day') {
      sendResponse({ date: displayedDay })
      return false
    }
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
