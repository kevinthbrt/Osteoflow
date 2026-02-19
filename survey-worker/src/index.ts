/**
 * Cloudflare Worker for Osteoflow patient surveys.
 *
 * Serves a beautiful, mobile-friendly survey form and stores responses in KV.
 * The Electron desktop app registers surveys before sending J+7 emails,
 * then periodically syncs completed responses back to local SQLite.
 *
 * Routes:
 *   POST /api/surveys          - Register a new survey (called by Electron app)
 *   GET  /survey/:token        - Serve the survey form (patient-facing)
 *   POST /api/surveys/:token   - Submit survey response (patient's browser)
 *   POST /api/surveys/sync     - Fetch completed responses (called by Electron app)
 *   POST /api/surveys/delete   - Delete synced responses from KV (called by Electron app)
 */

interface Env {
  SURVEYS: KVNamespace
}

interface SurveyData {
  token: string
  practitioner_name: string
  practice_name: string
  patient_first_name: string
  primary_color: string
  specialty?: string
  consultation_id: string
  response?: SurveyResponseData
  created_at: string
  responded_at?: string
}

interface SurveyResponseData {
  overall_rating: number
  eva_score: number
  pain_reduction: boolean
  better_mobility: boolean
  comment?: string
  // Legacy fields (kept for backward compatibility with old responses)
  pain_evolution?: 'better' | 'same' | 'worse'
  would_recommend?: boolean
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    // CORS headers for API routes (Electron app calls from localhost)
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    try {
      // POST /api/surveys - Register a new survey
      if (path === '/api/surveys' && request.method === 'POST') {
        return handleRegister(request, env, corsHeaders)
      }

      // GET /survey/:token - Serve survey form
      if (path.startsWith('/survey/') && request.method === 'GET') {
        const token = path.replace('/survey/', '')
        return handleSurveyPage(token, env)
      }

      // POST /api/surveys/sync - Fetch completed responses
      if (path === '/api/surveys/sync' && request.method === 'POST') {
        return handleSync(request, env, corsHeaders)
      }

      // POST /api/surveys/delete - Delete synced responses
      if (path === '/api/surveys/delete' && request.method === 'POST') {
        return handleDelete(request, env, corsHeaders)
      }

      // POST /api/surveys/:token - Submit survey response
      if (path.startsWith('/api/surveys/') && request.method === 'POST') {
        const token = path.replace('/api/surveys/', '')
        return handleSubmit(token, request, env, corsHeaders)
      }

      return new Response('Not Found', { status: 404 })
    } catch (error) {
      console.error('Worker error:', error)
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }
  },
} satisfies ExportedHandler<Env>

async function handleRegister(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const body = await request.json() as Partial<SurveyData>

  if (!body.token || !body.practitioner_name || !body.patient_first_name) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: token, practitioner_name, patient_first_name' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  const surveyData: SurveyData = {
    token: body.token,
    practitioner_name: body.practitioner_name,
    practice_name: body.practice_name || body.practitioner_name,
    patient_first_name: body.patient_first_name,
    primary_color: body.primary_color || '#2563eb',
    specialty: body.specialty,
    consultation_id: body.consultation_id || '',
    created_at: new Date().toISOString(),
  }

  // Store in KV with 30-day TTL
  await env.SURVEYS.put(
    `survey:${body.token}`,
    JSON.stringify(surveyData),
    { expirationTtl: 30 * 24 * 60 * 60 }
  )

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  )
}

async function handleSurveyPage(token: string, env: Env): Promise<Response> {
  const raw = await env.SURVEYS.get(`survey:${token}`)

  if (!raw) {
    return new Response(renderExpiredPage(), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const survey = JSON.parse(raw) as SurveyData

  if (survey.response) {
    return new Response(renderAlreadySubmittedPage(survey), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  return new Response(renderSurveyPage(survey), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

async function handleSubmit(
  token: string,
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const raw = await env.SURVEYS.get(`survey:${token}`)

  if (!raw) {
    return new Response(
      JSON.stringify({ error: 'Survey not found or expired' }),
      { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  const survey = JSON.parse(raw) as SurveyData

  if (survey.response) {
    return new Response(
      JSON.stringify({ error: 'Survey already submitted' }),
      { status: 409, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  const body = await request.json() as Partial<SurveyResponseData>

  if (!body.overall_rating || body.eva_score === undefined || body.pain_reduction === undefined || body.better_mobility === undefined) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  survey.response = {
    overall_rating: body.overall_rating,
    eva_score: body.eva_score,
    pain_reduction: body.pain_reduction,
    better_mobility: body.better_mobility,
    comment: body.comment || undefined,
  }
  survey.responded_at = new Date().toISOString()

  await env.SURVEYS.put(
    `survey:${token}`,
    JSON.stringify(survey),
    { expirationTtl: 30 * 24 * 60 * 60 }
  )

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  )
}

async function handleSync(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const { tokens } = await request.json() as { tokens: string[] }

  if (!tokens || !Array.isArray(tokens)) {
    return new Response(
      JSON.stringify({ error: 'tokens array required' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  const results: Array<{
    token: string
    consultation_id: string
    response: SurveyResponseData
    responded_at: string
  }> = []

  for (const token of tokens.slice(0, 50)) {
    const raw = await env.SURVEYS.get(`survey:${token}`)
    if (!raw) continue

    const survey = JSON.parse(raw) as SurveyData
    if (survey.response && survey.responded_at) {
      results.push({
        token,
        consultation_id: survey.consultation_id,
        response: survey.response,
        responded_at: survey.responded_at,
      })
    }
  }

  return new Response(
    JSON.stringify({ results }),
    { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  )
}

async function handleDelete(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const { tokens } = await request.json() as { tokens: string[] }

  if (!tokens || !Array.isArray(tokens)) {
    return new Response(
      JSON.stringify({ error: 'tokens array required' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }

  for (const token of tokens) {
    await env.SURVEYS.delete(`survey:${token}`)
  }

  return new Response(
    JSON.stringify({ success: true, deleted: tokens.length }),
    { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  )
}

// ─── HTML Templates ─────────────────────────────────────────────────────────

function renderSurveyPage(survey: SurveyData): string {
  const color = survey.primary_color
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Questionnaire de suivi - ${survey.practice_name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #f1f5f9; color: #334155; min-height: 100vh;
      display: flex; flex-direction: column; align-items: center;
    }
    .header {
      width: 100%; padding: 32px 20px; text-align: center;
      background: linear-gradient(135deg, ${color} 0%, #0f172a 100%); color: #fff;
    }
    .header h1 { font-size: 22px; font-weight: 700; margin-bottom: 6px; }
    .header p { font-size: 15px; opacity: 0.85; }
    .card {
      max-width: 560px; width: 100%; margin: -24px 16px 32px; padding: 28px 24px;
      background: #fff; border-radius: 16px;
      box-shadow: 0 10px 30px rgba(15,23,42,0.08);
    }
    .greeting { font-size: 17px; line-height: 1.6; margin-bottom: 28px; color: #475569; }
    .question { font-size: 15px; font-weight: 600; color: #0f172a; margin-bottom: 14px; }
    .emoji-row { display: flex; justify-content: center; gap: 8px; margin-bottom: 28px; }
    .emoji-btn {
      width: 56px; height: 56px; border-radius: 50%; border: 2px solid #e2e8f0;
      background: #fff; cursor: pointer; font-size: 28px;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s;
    }
    .emoji-btn:hover { border-color: ${color}; transform: scale(1.1); }
    .emoji-btn.selected { border-color: ${color}; background: ${color}15; transform: scale(1.15); }
    .emoji-label { font-size: 11px; color: #94a3b8; text-align: center; margin-top: 4px; }
    .options { display: flex; flex-direction: column; gap: 10px; margin-bottom: 28px; }
    .option-btn {
      display: flex; align-items: center; gap: 12px;
      padding: 14px 18px; border-radius: 12px; border: 2px solid #e2e8f0;
      background: #fff; cursor: pointer; font-size: 15px; color: #334155;
      transition: all 0.2s;
    }
    .option-btn:hover { border-color: ${color}; }
    .option-btn.selected { border-color: ${color}; background: ${color}10; }
    .option-icon { font-size: 22px; }
    .eva-container { margin-bottom: 28px; }
    .eva-slider-wrap { position: relative; padding: 0 8px; }
    .eva-slider {
      -webkit-appearance: none; appearance: none; width: 100%; height: 8px;
      border-radius: 4px; outline: none;
      background: linear-gradient(to right, #22c55e 0%, #eab308 50%, #ef4444 100%);
    }
    .eva-slider::-webkit-slider-thumb {
      -webkit-appearance: none; appearance: none; width: 28px; height: 28px;
      border-radius: 50%; background: ${color}; cursor: pointer;
      border: 3px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    .eva-slider::-moz-range-thumb {
      width: 28px; height: 28px; border-radius: 50%; background: ${color};
      cursor: pointer; border: 3px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    .eva-labels { display: flex; justify-content: space-between; margin-top: 8px; font-size: 12px; color: #94a3b8; }
    .eva-value {
      text-align: center; font-size: 32px; font-weight: 700; color: ${color};
      margin-bottom: 12px;
    }
    .eva-value span { font-size: 16px; font-weight: 400; color: #94a3b8; }
    .yn-row { display: flex; gap: 12px; margin-bottom: 28px; }
    .yn-btn {
      flex: 1; padding: 14px; border-radius: 12px; border: 2px solid #e2e8f0;
      background: #fff; cursor: pointer; font-size: 15px; font-weight: 500;
      text-align: center; transition: all 0.2s;
    }
    .yn-btn:hover { border-color: ${color}; }
    .yn-btn.selected { border-color: ${color}; background: ${color}10; }
    textarea {
      width: 100%; min-height: 100px; padding: 14px; border-radius: 12px;
      border: 2px solid #e2e8f0; font-size: 15px; font-family: inherit;
      resize: vertical; margin-bottom: 28px; color: #334155;
      transition: border-color 0.2s;
    }
    textarea:focus { outline: none; border-color: ${color}; }
    textarea::placeholder { color: #94a3b8; }
    .submit-btn {
      width: 100%; padding: 16px; border: none; border-radius: 12px;
      background: ${color}; color: #fff; font-size: 16px; font-weight: 600;
      cursor: pointer; transition: opacity 0.2s;
    }
    .submit-btn:hover { opacity: 0.9; }
    .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .footer { text-align: center; padding: 16px; color: #94a3b8; font-size: 12px; }
    .success-icon { font-size: 64px; margin-bottom: 16px; }
    .divider { height: 1px; background: #e2e8f0; margin: 4px 0 24px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Comment allez-vous ?</h1>
    <p>${survey.practice_name}</p>
  </div>

  <div class="card" id="survey-form">
    <p class="greeting">
      Bonjour ${survey.patient_first_name},<br><br>
      Votre avis nous est pr&eacute;cieux. Ce court questionnaire nous aide &agrave;
      am&eacute;liorer votre prise en charge.
    </p>

    <!-- Q1: Overall rating -->
    <p class="question">Comment vous sentez-vous aujourd'hui ?</p>
    <div class="emoji-row" id="rating-row">
      <div>
        <button class="emoji-btn" data-value="1" onclick="selectRating(1)">&#128542;</button>
        <div class="emoji-label">Tr&egrave;s mal</div>
      </div>
      <div>
        <button class="emoji-btn" data-value="2" onclick="selectRating(2)">&#128533;</button>
        <div class="emoji-label">Mal</div>
      </div>
      <div>
        <button class="emoji-btn" data-value="3" onclick="selectRating(3)">&#128528;</button>
        <div class="emoji-label">Moyen</div>
      </div>
      <div>
        <button class="emoji-btn" data-value="4" onclick="selectRating(4)">&#128578;</button>
        <div class="emoji-label">Bien</div>
      </div>
      <div>
        <button class="emoji-btn" data-value="5" onclick="selectRating(5)">&#128513;</button>
        <div class="emoji-label">Tr&egrave;s bien</div>
      </div>
    </div>

    <!-- Q2: EVA Pain Scale -->
    <p class="question">&Agrave; combien &eacute;valuez-vous votre douleur aujourd'hui ?</p>
    <div class="eva-container">
      <div class="eva-value" id="eva-display">0 <span>/ 10</span></div>
      <div class="eva-slider-wrap">
        <input type="range" class="eva-slider" id="eva-slider" min="0" max="10" value="0" oninput="updateEva(this.value)">
      </div>
      <div class="eva-labels">
        <span>Aucune douleur</span>
        <span>Douleur maximale</span>
      </div>
    </div>

    <!-- Q3: Pain reduction -->
    <p class="question">Diminution de la douleur ?</p>
    <div class="yn-row" id="pain-reduction-row">
      <button class="yn-btn" data-value="true" onclick="selectPainReduction(true)">&#128994; Oui</button>
      <button class="yn-btn" data-value="false" onclick="selectPainReduction(false)">&#128308; Non</button>
    </div>

    <!-- Q4: Better mobility -->
    <p class="question">Meilleure mobilit&eacute; ?</p>
    <div class="yn-row" id="mobility-row">
      <button class="yn-btn" data-value="true" onclick="selectMobility(true)">&#128994; Oui</button>
      <button class="yn-btn" data-value="false" onclick="selectMobility(false)">&#128308; Non</button>
    </div>

    <!-- Q5: Comment -->
    <p class="question">Un commentaire ? <span style="font-weight:400;color:#94a3b8">(facultatif)</span></p>
    <textarea id="comment" placeholder="Partagez votre ressenti..."></textarea>

    <div class="divider"></div>

    <button class="submit-btn" id="submit-btn" disabled onclick="submitSurvey()">
      Envoyer mes r&eacute;ponses
    </button>
  </div>

  <!-- Success state (hidden by default) -->
  <div class="card" id="success-card" style="display:none; text-align:center; padding:48px 24px;">
    <div class="success-icon">&#10004;&#65039;</div>
    <h2 style="font-size:22px; margin-bottom:12px; color:#0f172a;">Merci ${survey.patient_first_name} !</h2>
    <p style="font-size:15px; color:#64748b; line-height:1.6;">
      Vos r&eacute;ponses ont bien &eacute;t&eacute; enregistr&eacute;es.<br>
      Elles nous aident &agrave; am&eacute;liorer votre prise en charge.
    </p>
  </div>

  <p class="footer">Envoy&eacute; via Osteoflow</p>

  <script>
    let rating = null, evaScore = 0, evaChanged = false, painReduction = null, mobility = null;

    function selectRating(val) {
      rating = val;
      document.querySelectorAll('#rating-row .emoji-btn').forEach(b => {
        b.classList.toggle('selected', Number(b.dataset.value) === val);
      });
      checkForm();
    }

    function updateEva(val) {
      evaScore = Number(val);
      evaChanged = true;
      document.getElementById('eva-display').innerHTML = val + ' <span>/ 10</span>';
      checkForm();
    }

    function selectPainReduction(val) {
      painReduction = val;
      document.querySelectorAll('#pain-reduction-row .yn-btn').forEach(b => {
        b.classList.toggle('selected', b.dataset.value === String(val));
      });
      checkForm();
    }

    function selectMobility(val) {
      mobility = val;
      document.querySelectorAll('#mobility-row .yn-btn').forEach(b => {
        b.classList.toggle('selected', b.dataset.value === String(val));
      });
      checkForm();
    }

    function checkForm() {
      document.getElementById('submit-btn').disabled = !(rating && evaChanged && painReduction !== null && mobility !== null);
    }

    async function submitSurvey() {
      const btn = document.getElementById('submit-btn');
      btn.disabled = true;
      btn.textContent = 'Envoi en cours...';

      try {
        const res = await fetch('/api/surveys/${survey.token}', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            overall_rating: rating,
            eva_score: evaScore,
            pain_reduction: painReduction,
            better_mobility: mobility,
            comment: document.getElementById('comment').value || undefined,
          }),
        });

        if (res.ok) {
          document.getElementById('survey-form').style.display = 'none';
          document.getElementById('success-card').style.display = 'block';
        } else {
          const data = await res.json();
          if (res.status === 409) {
            document.getElementById('survey-form').style.display = 'none';
            document.getElementById('success-card').style.display = 'block';
          } else {
            alert('Une erreur est survenue. Veuillez r\\u00e9essayer.');
            btn.disabled = false;
            btn.textContent = 'Envoyer mes r\\u00e9ponses';
          }
        }
      } catch {
        alert('Erreur de connexion. V\\u00e9rifiez votre connexion internet.');
        btn.disabled = false;
        btn.textContent = 'Envoyer mes r\\u00e9ponses';
      }
    }
  </script>
</body>
</html>`
}

function renderAlreadySubmittedPage(survey: SurveyData): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Questionnaire d&eacute;j&agrave; rempli - ${survey.practice_name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f1f5f9; min-height: 100vh;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 32px 16px;
    }
    .card {
      max-width: 480px; width: 100%; padding: 48px 32px; text-align: center;
      background: #fff; border-radius: 16px;
      box-shadow: 0 10px 30px rgba(15,23,42,0.08);
    }
    .icon { font-size: 64px; margin-bottom: 16px; }
    h1 { font-size: 22px; color: #0f172a; margin-bottom: 12px; }
    p { font-size: 15px; color: #64748b; line-height: 1.6; }
    .footer { margin-top: 24px; color: #94a3b8; font-size: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#10004;&#65039;</div>
    <h1>Merci ${survey.patient_first_name} !</h1>
    <p>Vous avez d&eacute;j&agrave; r&eacute;pondu &agrave; ce questionnaire. Vos r&eacute;ponses ont &eacute;t&eacute; transmises.</p>
  </div>
  <p class="footer">Envoy&eacute; via Osteoflow</p>
</body>
</html>`
}

function renderExpiredPage(): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Questionnaire expir&eacute;</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f1f5f9; min-height: 100vh;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 32px 16px;
    }
    .card {
      max-width: 480px; width: 100%; padding: 48px 32px; text-align: center;
      background: #fff; border-radius: 16px;
      box-shadow: 0 10px 30px rgba(15,23,42,0.08);
    }
    .icon { font-size: 64px; margin-bottom: 16px; }
    h1 { font-size: 22px; color: #0f172a; margin-bottom: 12px; }
    p { font-size: 15px; color: #64748b; line-height: 1.6; }
    .footer { margin-top: 24px; color: #94a3b8; font-size: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#8987;</div>
    <h1>Questionnaire indisponible</h1>
    <p>Ce questionnaire a expir&eacute; ou n'existe pas. Si vous pensez qu'il s'agit d'une erreur, contactez votre praticien.</p>
  </div>
  <p class="footer">Osteoflow</p>
</body>
</html>`
}
