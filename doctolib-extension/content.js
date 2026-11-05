/*
 * Osteoflow : import Doctolib, script de page (pro.doctolib.fr uniquement).
 *
 * Une fois l'agenda chargé, il lit les rendez-vous de la semaine en cours
 * avec la session Doctolib déjà ouverte (à l'ouverture, puis toutes les 10
 * minutes tant que l'onglet reste ouvert ; désactivable dans l'extension),
 * garde seulement les champs utiles et les passe à l'extension, qui les envoie
 * à Osteoflow sur ce poste. Aucune donnée ne part ailleurs. Un petit bouton
 * « Osteoflow » permet de synchroniser à la demande.
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
    setTimeout(onAgendaReady, 0)
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

  // ── Synchronisation automatique de la semaine ──
  const SYNC_EVERY = 10 * 60 * 1000
  const MIN_GAP = 4 * 60 * 1000

  const dayString = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const today = () => dayString(new Date())
  const addDays = (day, delta) => {
    const d = new Date(`${day}T12:00:00`)
    d.setDate(d.getDate() + delta)
    return dayString(d)
  }
  /** Lundi au dimanche de la semaine en cours ; le week-end, jusqu'au dimanche suivant. */
  const syncRange = () => {
    const now = new Date()
    const weekday = (now.getDay() + 6) % 7
    const start = addDays(today(), -weekday)
    return { start, end: addDays(start, weekday >= 5 ? 13 : 6) }
  }

  async function fetchRange(start, end, agendaIds) {
    const params = new URLSearchParams({
      agenda_ids: agendaIds,
      start_date: `${start} 00:00:00`,
      end_date: `${end} 23:59:59`,
      view: start === end ? 'day' : 'week',
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

  async function settings() {
    try {
      return await chrome.storage.local.get(['autoSync', 'agenda', 'lastSyncAt', 'hideButton'])
    } catch (_) {
      return {}
    }
  }

  let syncing = false
  let lastResult = null

  /**
   * Envoie la semaine (et le jour affiché s'il est en dehors) à Osteoflow.
   * `force` : clic du praticien ; sinon, au plus une fois toutes les 4 minutes
   * pour tous les onglets Doctolib ouverts.
   */
  async function sync(force) {
    if (syncing) return lastResult
    const config = await settings()
    if (!force && config.autoSync === false) return null
    if (!force && config.lastSyncAt && Date.now() - config.lastSyncAt < MIN_GAP) return null
    const agendaIds = (config.agenda || detectedAgendaIds || '').trim()
    if (!agendaIds) {
      if (force) throw new Error('Affichez votre agenda, puis réessayez.')
      return null
    }
    syncing = true
    try {
      await chrome.storage.local.set({ lastSyncAt: Date.now() })
      const ranges = [syncRange()]
      if (force && displayedDay && (displayedDay < ranges[0].start || displayedDay > ranges[0].end)) {
        ranges.push({ start: displayedDay, end: displayedDay })
      }
      let result = null
      for (const range of ranges) {
        const appointments = await fetchRange(range.start, range.end, agendaIds)
        const reply = await chrome.runtime.sendMessage({ type: 'osteoflow:sync', ...range, appointments })
        if (!reply || !reply.ok) throw new Error((reply && reply.error) || 'Envoi impossible.')
        result = result || reply
      }
      lastResult = { ...result, at: Date.now() }
      return lastResult
    } finally {
      syncing = false
    }
  }

  // ── Bouton « Osteoflow » dans la page ──
  let host = null
  let label = null
  let state = 'idle'

  const clock = (time) => new Date(time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  function render(text) {
    if (!label) return
    label.textContent = text || (lastResult ? `Osteoflow · synchronisé à ${clock(lastResult.at)}` : 'Synchroniser avec Osteoflow')
  }

  function flash(kind, text) {
    if (!host) return
    host.dataset.state = kind
    render(text)
    state = 'done'
    setTimeout(() => {
      state = 'idle'
      if (host) host.dataset.state = 'idle'
      render()
    }, 6000)
  }

  async function syncFromButton() {
    if (state === 'busy') return
    state = 'busy'
    host.dataset.state = 'busy'
    render('Synchronisation…')
    try {
      const result = await sync(true)
      const parts = [`${result.received} rendez-vous`]
      if (result.added > 0) parts.push(`${result.added} ajouté${result.added > 1 ? 's' : ''} à Ma journée`)
      if (result.toReview > 0) parts.push(`${result.toReview} à vérifier`)
      flash('ok', `${parts.join(', ')} ✓`)
    } catch (error) {
      flash('error', error.message || String(error))
    }
  }

  async function showButton() {
    if (host) {
      if (state === 'idle') render()
      return
    }
    host = document.createElement('div')
    host.id = 'osteoflow-send'
    const { hideButton } = await settings()
    if (hideButton) return
    const root = host.attachShadow({ mode: 'closed' })
    root.innerHTML = `
      <style>
        :host { all: initial; position: fixed; right: 20px; bottom: 20px; z-index: 2147483000; }
        .pill { display: flex; align-items: center; gap: 2px; padding: 4px; border-radius: 999px; background: #fff;
          box-shadow: 0 6px 24px rgba(16,24,40,.18), 0 0 0 1px rgba(16,24,40,.08); font: 600 13px/1 Inter, system-ui, -apple-system, "Segoe UI", sans-serif; }
        button { all: unset; cursor: pointer; display: flex; align-items: center; gap: 8px; border-radius: 999px; }
        .send { padding: 8px 14px 8px 8px; background: #2f5fe8; color: #fff; max-width: 380px; }
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
        <button class="send" type="button" title="Synchronise maintenant la semaine avec Osteoflow, sur ce poste">
          <img alt="" src="${chrome.runtime.getURL('icons/icon-32.png')}"><span></span>
        </button>
        <button class="close" type="button" title="Masquer ce bouton (la synchronisation continue ; réglage dans l’icône de l’extension)" aria-label="Masquer">×</button>
      </div>`
    label = root.querySelector('span')
    root.querySelector('.send').addEventListener('click', syncFromButton)
    root.querySelector('.close').addEventListener('click', () => {
      chrome.storage.local.set({ hideButton: true })
      host.remove()
    })
    render()
    const attach = () => document.body.appendChild(host)
    if (document.body) attach()
    else document.addEventListener('DOMContentLoaded', attach, { once: true })
  }

  // Dès que l'agenda est là, puis régulièrement et au retour sur l'onglet.
  let started = false
  function onAgendaReady() {
    if (window.top !== window) return
    showButton()
    if (started) return
    started = true
    const quiet = () => sync(false).then(() => { if (state === 'idle') render() }).catch(() => {})
    quiet()
    setInterval(quiet, SYNC_EVERY)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') quiet()
    })
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
      sendResponse({ date: displayedDay, lastResult })
      return false
    }
    if (message && message.type === 'osteoflow:sync-now') {
      sync(true)
        .then((result) => sendResponse({ ok: true, ...result }))
        .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }))
      return true
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
    fetchRange(message.date, message.date, agendaIds)
      .then((appointments) => sendResponse({ ok: true, appointments, agendaIds }))
      .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }))
    return true // réponse asynchrone
  })
})()
