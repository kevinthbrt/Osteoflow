/**
 * Demo seed script — creates a SQLite DB with realistic demo data.
 * Run: node scripts/seed-demo.mjs
 */
import Database from 'better-sqlite3'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

function uuid() {
  return crypto.randomUUID()
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

const dbDir = path.join(process.env.HOME, '.config', 'Osteoflow')
fs.mkdirSync(dbDir, { recursive: true })
const dbPath = path.join(dbDir, 'osteoflow.db')

// Remove old DB if exists
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath)
  console.log('Removed old DB')
}

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// Custom function for the app
db.function('unaccent', { deterministic: true }, (text) => {
  if (text == null) return null
  return String(text).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
})

// ── Schema ──────────────────────────────────────────────────────────────────
db.exec(`
CREATE TABLE IF NOT EXISTS practitioners (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  practice_name TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  siret TEXT,
  default_rate REAL DEFAULT 60.00,
  invoice_prefix TEXT DEFAULT 'FACT',
  invoice_next_number INTEGER DEFAULT 1,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#2563eb',
  rpps TEXT,
  status TEXT,
  specialty TEXT,
  stamp_url TEXT,
  accountant_email TEXT,
  google_review_url TEXT,
  password_hash TEXT,
  owner_id TEXT,
  profession TEXT DEFAULT 'osteopathe',
  annual_revenue_objective REAL,
  vacation_weeks_per_year INTEGER DEFAULT 5,
  working_days_per_week INTEGER DEFAULT 4,
  average_consultation_price REAL,
  follow_up_delay_days INTEGER DEFAULT 7,
  vat_regime TEXT DEFAULT 'exempt_261',
  rpe TEXT,
  rne TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  practitioner_id TEXT NOT NULL REFERENCES practitioners(id),
  gender TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  birth_date TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  profession TEXT,
  sport_activity TEXT,
  primary_physician TEXT,
  trauma_history TEXT,
  medical_history TEXT,
  surgical_history TEXT,
  family_history TEXT,
  notes TEXT,
  referred_by_patient_id TEXT,
  referred_by_source TEXT,
  pregnancy_due_date TEXT,
  archived_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS session_types (
  id TEXT PRIMARY KEY,
  practitioner_id TEXT NOT NULL REFERENCES practitioners(id),
  name TEXT NOT NULL,
  price REAL NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS consultations (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  date_time TEXT NOT NULL,
  reason TEXT NOT NULL,
  anamnesis TEXT,
  anamnesis_sections TEXT,
  clinical_hypotheses TEXT,
  examination TEXT,
  advice TEXT,
  follow_up_7d INTEGER DEFAULT 0,
  follow_up_sent_at TEXT,
  send_post_session_advice INTEGER DEFAULT 0,
  post_session_advice_sent_at TEXT,
  session_type_id TEXT,
  cabinet_id TEXT,
  archived_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  consultation_id TEXT NOT NULL UNIQUE REFERENCES consultations(id),
  invoice_number TEXT NOT NULL UNIQUE,
  amount REAL NOT NULL,
  status TEXT DEFAULT 'draft',
  issued_at TEXT,
  paid_at TEXT,
  pdf_url TEXT,
  notes TEXT,
  cabinet_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  amount REAL NOT NULL,
  method TEXT NOT NULL,
  payment_date TEXT DEFAULT (date('now')),
  check_number TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS generated_letters (
  id TEXT PRIMARY KEY,
  practitioner_id TEXT NOT NULL REFERENCES practitioners(id),
  consultation_id TEXT REFERENCES consultations(id),
  patient_id TEXT REFERENCES patients(id),
  template_id TEXT NOT NULL,
  template_name TEXT NOT NULL,
  header TEXT NOT NULL,
  body TEXT NOT NULL,
  recipient_name TEXT,
  recipient_title TEXT,
  closing TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  practitioner_id TEXT NOT NULL REFERENCES practitioners(id),
  patient_id TEXT REFERENCES patients(id),
  subject TEXT,
  last_message_at TEXT DEFAULT (datetime('now')),
  unread_count INTEGER DEFAULT 0,
  is_archived INTEGER DEFAULT 0,
  external_email TEXT,
  external_name TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  content TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'outgoing',
  channel TEXT NOT NULL DEFAULT 'internal',
  status TEXT NOT NULL DEFAULT 'sent',
  consultation_id TEXT,
  sent_at TEXT,
  delivered_at TEXT,
  read_at TEXT,
  email_subject TEXT,
  email_message_id TEXT,
  external_email_id TEXT,
  from_email TEXT,
  to_email TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS medical_history_entries (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  history_type TEXT NOT NULL,
  description TEXT NOT NULL,
  onset_date TEXT,
  onset_age INTEGER,
  is_vigilance INTEGER DEFAULT 0,
  note TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS survey_responses (
  id TEXT PRIMARY KEY,
  consultation_id TEXT NOT NULL REFERENCES consultations(id),
  patient_id TEXT NOT NULL REFERENCES patients(id),
  practitioner_id TEXT NOT NULL REFERENCES practitioners(id),
  token TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'completed',
  overall_rating INTEGER,
  eva_score INTEGER,
  pain_reduction INTEGER,
  better_mobility INTEGER,
  pain_evolution TEXT,
  comment TEXT,
  would_recommend INTEGER,
  responded_at TEXT,
  acknowledged_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  synced_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  practitioner_id TEXT,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL,
  old_data TEXT,
  new_data TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS saved_reports (
  id TEXT PRIMARY KEY,
  practitioner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  filters TEXT NOT NULL DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS message_templates (
  id TEXT PRIMARY KEY,
  practitioner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  use_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS email_templates (
  id TEXT PRIMARY KEY,
  practitioner_id TEXT NOT NULL,
  type TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id TEXT PRIMARY KEY,
  practitioner_id TEXT NOT NULL,
  type TEXT NOT NULL,
  consultation_id TEXT,
  scheduled_for TEXT NOT NULL,
  executed_at TEXT,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS manual_revenue_entries (
  id TEXT PRIMARY KEY,
  practitioner_id TEXT NOT NULL REFERENCES practitioners(id),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(practitioner_id, year, month)
);

CREATE TABLE IF NOT EXISTS custom_clinical_content (
  id TEXT PRIMARY KEY,
  practitioner_id TEXT NOT NULL REFERENCES practitioners(id),
  content_type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  region TEXT,
  sort_order INTEGER DEFAULT 0,
  use_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS exercise_prescriptions (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  consultation_id TEXT,
  title TEXT NOT NULL DEFAULT 'Programme de rééducation',
  notes TEXT,
  patient_intro TEXT,
  vigilance_points TEXT,
  weekly_routine TEXT,
  clinical_notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS exercise_prescription_items (
  id TEXT PRIMARY KEY,
  prescription_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  exercise_description TEXT NOT NULL,
  exercise_region TEXT NOT NULL,
  exercise_type TEXT NOT NULL,
  exercise_level INTEGER DEFAULT 1,
  illustration_url TEXT,
  nerve_target TEXT,
  progression_regression TEXT,
  sets INTEGER,
  reps TEXT,
  hold_time INTEGER,
  rest_time INTEGER,
  frequency TEXT,
  notes TEXT,
  position INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS consultation_attachments (
  id TEXT PRIMARY KEY,
  consultation_id TEXT NOT NULL REFERENCES consultations(id),
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT,
  file_size INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);
`)

// ── Seed data ──────────────────────────────────────────────────────────────
const ownerId = uuid()
const practId = uuid()
const userId = uuid()
const now = new Date().toISOString()

db.prepare(`
  INSERT INTO practitioners (id, user_id, first_name, last_name, email, phone, practice_name, address, city, postal_code, rpps, default_rate, invoice_prefix, invoice_next_number, primary_color, password_hash, owner_id, annual_revenue_objective, vacation_weeks_per_year, working_days_per_week, average_consultation_price, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  practId, userId,
  'Jean-Baptiste', 'MARTIN',
  'jb.martin@osteoflow.fr',
  '06 12 34 56 78',
  'Cabinet Ostéopathie Paris 11',
  '24 rue de la Roquette',
  'Paris',
  '75011',
  '10012345678',
  65.0,
  'FACT',
  42,
  '#2563eb',
  hashPassword('demo1234'),
  ownerId,
  95000,
  5, 4, 65,
  now, now
)

// Set current user session
db.prepare("INSERT OR REPLACE INTO app_config (key, value) VALUES ('current_user_id', ?)").run(userId)
db.prepare("INSERT OR REPLACE INTO app_config (key, value) VALUES ('cabinet_owner_id', ?)").run(ownerId)
db.prepare("INSERT OR REPLACE INTO app_config (key, value) VALUES ('license_email', ?)").run('jb.martin@osteoflow.fr')
db.prepare("INSERT OR REPLACE INTO app_config (key, value) VALUES ('session_locked', '0')").run()
db.prepare("INSERT OR REPLACE INTO app_config (key, value) VALUES ('tour_completed', '1')").run()
db.prepare("INSERT OR REPLACE INTO app_config (key, value) VALUES ('cgu_accepted', '1')").run()
db.prepare("INSERT OR REPLACE INTO app_config (key, value) VALUES ('whats_new_seen_version', '999.0.0')").run()
db.prepare("INSERT OR REPLACE INTO app_config (key, value) VALUES ('backup_reminder_seen_at', ?)").run(now)

// Session types
const stId1 = uuid()
const stId2 = uuid()
db.prepare(`INSERT INTO session_types (id, practitioner_id, name, price, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)`).run(stId1, practId, 'Consultation adulte', 65, now, now)
db.prepare(`INSERT INTO session_types (id, practitioner_id, name, price, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)`).run(stId2, practId, 'Consultation nourrisson', 75, now, now)

// Patients
const patients = [
  { gender: 'F', first: 'Sophie', last: 'DUPONT', birth: '1987-03-15', phone: '06 23 45 67 89', email: 'sophie.dupont@gmail.com', profession: 'Infirmière', sport: 'Yoga', physician: 'Dr. Lefebvre' },
  { gender: 'M', first: 'Thomas', last: 'BERNARD', birth: '1979-07-22', phone: '06 34 56 78 90', email: 'thomas.bernard@orange.fr', profession: 'Développeur', sport: 'Course à pied', physician: 'Dr. Moreau' },
  { gender: 'F', first: 'Marie', last: 'LECLERC', birth: '1995-11-08', phone: '06 45 67 89 01', email: 'marie.leclerc@hotmail.fr', profession: 'Étudiante', sport: 'Natation', physician: 'Dr. Simon' },
  { gender: 'M', first: 'Pierre', last: 'ROUX', birth: '1965-04-30', phone: '06 56 78 90 12', email: '', profession: 'Retraité', sport: '', physician: 'Dr. Petit' },
  { gender: 'F', first: 'Isabelle', last: 'GARNIER', birth: '1992-09-14', phone: '06 67 89 01 23', email: 'isabelle.garnier@gmail.com', profession: 'Architecte', sport: 'Pilates', physician: 'Dr. Lambert' },
  { gender: 'M', first: 'Lucas', last: 'FONTAINE', birth: '2001-02-28', phone: '07 12 34 56 78', email: 'lucas.fontaine@gmail.com', profession: 'Étudiant', sport: 'Football', physician: 'Dr. Moreau' },
  { gender: 'F', first: 'Claire', last: 'MOREL', birth: '1983-06-17', phone: '06 78 90 12 34', email: 'claire.morel@free.fr', profession: 'Comptable', sport: 'Marche', physician: 'Dr. Lefebvre' },
  { gender: 'M', first: 'Antoine', last: 'SIMON', birth: '1971-12-03', phone: '06 89 01 23 45', email: 'antoine.simon@wanadoo.fr', profession: 'Artisan', sport: 'Vélo', physician: 'Dr. Petit' },
]

const patientIds = []
for (const p of patients) {
  const pid = uuid()
  patientIds.push(pid)
  db.prepare(`
    INSERT INTO patients (id, practitioner_id, gender, first_name, last_name, birth_date, phone, email, profession, sport_activity, primary_physician, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(pid, practId, p.gender, p.first, p.last, p.birth, p.phone, p.email, p.profession, p.sport, p.physician, now, now)
}

// Medical history entries
db.prepare(`INSERT INTO medical_history_entries (id, patient_id, history_type, description, onset_age, is_vigilance, display_order, created_at, updated_at) VALUES (?, ?, 'traumatic', 'Chute à vélo — fracture clavicule droite', 32, 0, 0, ?, ?)`).run(uuid(), patientIds[0], now, now)
db.prepare(`INSERT INTO medical_history_entries (id, patient_id, history_type, description, onset_age, is_vigilance, display_order, created_at, updated_at) VALUES (?, ?, 'medical', 'Hernie discale L4-L5 (2019)', 40, 1, 0, ?, ?)`).run(uuid(), patientIds[1], now, now)
db.prepare(`INSERT INTO medical_history_entries (id, patient_id, history_type, description, onset_age, is_vigilance, display_order, created_at, updated_at) VALUES (?, ?, 'surgical', 'Appendicectomie (2010)', 15, 0, 0, ?, ?)`).run(uuid(), patientIds[2], now, now)
db.prepare(`INSERT INTO medical_history_entries (id, patient_id, history_type, description, onset_age, is_vigilance, display_order, created_at, updated_at) VALUES (?, ?, 'medical', 'HTA traitée — Amlodipine 5mg', 55, 1, 0, ?, ?)`).run(uuid(), patientIds[3], now, now)

// Consultations (spread over last 6 months)
const consultData = [
  { pid: patientIds[0], daysAgo: 2, reason: 'Cervicalgie chronique avec irradiation occipitale', anamnesis: 'Patiente se plaignant de douleurs cervicales hautes depuis 3 semaines, aggravées par le travail sur écran. Sensation de lourdeur de la tête, céphalées de tension matinales. Léger vertige positionnel sans chute.', advice: 'Exercices de mobilisation cervicale matin/soir. Pause toutes les 45min devant l\'écran. Compresses chaudes. Revoir dans 3 semaines.', stId: stId1 },
  { pid: patientIds[1], daysAgo: 5, reason: 'Lombalgie subaiguë post-effort', anamnesis: 'Patient de 44 ans se plaignant de lombalgie depuis 10 jours suite à un déménagement. Douleur irradiant dans la fesse droite sans trajet sciatalique franc. EVA 5/10 au repos, 7/10 à la flexion. Antécédent de hernie discale L4-L5 vigilance.', advice: 'Maintien de l\'activité physique douce. Éviter port de charges > 5kg pendant 2 semaines. Hydratation ++.', stId: stId1 },
  { pid: patientIds[2], daysAgo: 8, reason: 'Douleur épaule droite — tendinopathie', anamnesis: 'Etudiante nageuse, douleur à l\'épaule droite à l\'élévation antérieure depuis 6 semaines. Aggravation lors de la nage crawl. Pas de traumatisme aigu. Arc douloureux 60-120°.', advice: 'Repos sportif relatif pendant 2 semaines. Glaçage 10min après effort. Programme d\'exercices de renforcement de la coiffe.', stId: stId1 },
  { pid: patientIds[3], daysAgo: 12, reason: 'Sciatalgie L5 droite — récurrence', anamnesis: 'Retraité 58 ans, récidive de sciatalgie L5 droite connue. Douleur irradiant jusqu\'au pied depuis 3 semaines. EVA 4/10, exacerbée par la station assise prolongée. Pas de déficit moteur ni trouble sphinctérien.', advice: 'Marche quotidienne 30min. Éviter la position assise > 1h. Chaleur sur zone lombaire. Revoir dans 15 jours.', stId: stId1 },
  { pid: patientIds[4], daysAgo: 15, reason: 'Syndrome du canal carpien bilatéral', anamnesis: 'Architecte 32 ans, paresthésies nocturnes des mains bilatérales depuis 2 mois, prédominant à droite. Signe de Tinel positif, Phalen positif à 40 secondes. Impact fonctionnel modéré sur le dessin technique.', advice: 'Port d\'atèle nocturne. Étirements des fléchisseurs. Adaptation du poste de travail. Bilan électromyographique conseillé.', stId: stId1 },
  { pid: patientIds[5], daysAgo: 20, reason: 'Entorse cheville droite - suivi J+14', anamnesis: 'Joueur de football, entorse cheville droite grade II il y a 14 jours. Bon début de récupération de la mobilité. Œdème résiduel modéré. Douleur à la palpation des ligaments péronéo-astragaliens antérieurs.', advice: 'Reprise course en ligne dans 2 semaines. Proprioception en décharge puis en charge. Renforcement péroniers.', stId: stId1 },
  { pid: patientIds[0], daysAgo: 45, reason: 'Bilan de santé annuel', anamnesis: 'Bilan de routine. Patiente asymptomatique. Tension generale bonne. Mobilités satisfaisantes. Légère restriction D6-D7 traitée.', advice: 'Séance de prévention recommandée dans 6 mois.', stId: stId1 },
  { pid: patientIds[6], daysAgo: 3, reason: 'Dorsalgies mécaniques — travail de bureau', anamnesis: 'Comptable 41 ans, douleurs dorsales inter-scapulaires depuis 1 mois. Aggravation en fin de journée. Travail sédentaire >8h/jour. Tension musculaire paravertébrale importante D4-D8.', advice: 'Exercices de renforcement des fixateurs des omoplates. Étirements pectoraux. Pause active toutes les heures.', stId: stId1 },
  { pid: patientIds[7], daysAgo: 7, reason: 'Névralgie cervico-brachiale C6', anamnesis: 'Artisan 52 ans, névralgie cervico-brachiale droite C6 depuis 3 semaines. Douleur irradiant dans le bras jusqu\'au pouce. Signe de Spurling positif. Pas de déficit sensitivo-moteur objectivé.', advice: 'Limitation des gestes en rotation droite. Position de décharge bras en écharpe si nécessaire. IRM cervicale recommandée.', stId: stId1 },
  { pid: patientIds[1], daysAgo: 60, reason: 'Lombalgie chronique — suivi', anamnesis: 'Suivi lombalgie chronique. Nette amélioration depuis la dernière séance. EVA 2/10. Patient reprend le sport progressivement.', advice: 'Maintenir programme de gainage. Revoir dans 2 mois.', stId: stId1 },
]

const consultIds = []
for (const c of consultData) {
  const cid = uuid()
  consultIds.push(cid)
  const dt = new Date(Date.now() - c.daysAgo * 86400000).toISOString()

  // Add AI-structured anamnesis sections for the first few
  let anamnesisSections = null
  let clinicalHypotheses = null
  if (c.daysAgo <= 10) {
    anamnesisSections = JSON.stringify({
      motif: c.reason,
      circonstances: 'Début progressif, pas de traumatisme aigu identifiable',
      douleur: { localisation: 'Zone principale concernée', intensite: 5, type: 'Mécanique', evolution: 'Fluctuante selon les activités' },
      antecedents: 'Voir dossier patient',
      facteurs: { aggravants: 'Station prolongée, mouvements répétés', soulageants: 'Repos, chaleur locale' },
    })
    clinicalHypotheses = JSON.stringify({
      hypotheses: [
        { titre: 'Dysfonction somatique primaire', probabilite: 'elevee', arguments: 'Cohérence clinique avec examen ostéopathique' },
        { titre: 'Composante musculo-tensionnelle', probabilite: 'elevee', arguments: 'Hypertonie musculaire palpée, facteur posture/stress' },
        { titre: 'À investiguer', probabilite: 'faible', arguments: 'Absence de drapeaux rouges' },
      ],
      drapeauxRouges: false,
      drapeauxJaunes: c.daysAgo <= 5,
      recommandations: 'Suivi dans 3 semaines, bilan complémentaire si pas d\'amélioration',
    })
  }

  db.prepare(`
    INSERT INTO consultations (id, patient_id, date_time, reason, anamnesis, anamnesis_sections, clinical_hypotheses, advice, follow_up_7d, session_type_id, cabinet_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(cid, c.pid, dt, c.reason, c.anamnesis, anamnesisSections, clinicalHypotheses, c.advice, 1, c.stId, practId, dt, dt)

  // Invoice
  const invId = uuid()
  const invNum = `FACT-2025-${String(consultIds.length).padStart(3, '0')}`
  const isPaid = c.daysAgo > 3
  db.prepare(`
    INSERT INTO invoices (id, consultation_id, invoice_number, amount, status, issued_at, paid_at, cabinet_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(invId, cid, invNum, 65, isPaid ? 'paid' : 'issued', dt, isPaid ? dt : null, practId, dt, dt)
}

// Generated letters
const letter1Id = uuid()
db.prepare(`
  INSERT INTO generated_letters (id, practitioner_id, consultation_id, patient_id, template_id, template_name, header, body, recipient_name, recipient_title, closing, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  letter1Id,
  practId,
  consultIds[0],
  patientIds[0],
  'tpl_medecin',
  'Courrier médecin traitant',
  `Dr Jean-Baptiste MARTIN\nOstéopathe D.O.\n24 rue de la Roquette\n75011 Paris\nTél : 06 12 34 56 78\n\nParis, le ${new Date().toLocaleDateString('fr-FR')}`,
  `Je vous adresse Mme Sophie DUPONT, née le 15/03/1987, pour vous informer de ma prise en charge ostéopathique.

Motif de consultation : Cervicalgie chronique avec irradiation occipitale évoluant depuis 3 semaines.

À l'examen, je retrouve :
- Des restrictions de mobilité cervicales hautes bilatérales, prédominant à droite en C1-C2
- Une hypertonie des muscles sous-occipitaux et sterno-cléido-mastoïdiens
- Des points trigger actifs au niveau des trapèzes supérieurs

Traitement réalisé :
- Techniques de mobilisation douce en C0-C1-C2 et OCC-C1
- Étirement myofascial des muscles sous-occipitaux
- Techniques viscérales crâniennes adaptées

Évolution : Bonne réponse thérapeutique immédiate avec augmentation des amplitudes et diminution de la douleur (EVA 6→3).

Je lui ai conseillé des exercices de mobilisation cervicale quotidiens et une réévaluation dans 3 semaines.

Je reste à votre disposition pour tout renseignement complémentaire.`,
  'Dr Lefebvre',
  'Médecin généraliste',
  `Confraternellement,\n\nDr J.-B. MARTIN\nOstéopathe D.O.`,
  now, now
)

db.prepare(`
  INSERT INTO generated_letters (id, practitioner_id, consultation_id, patient_id, template_id, template_name, header, body, recipient_name, recipient_title, closing, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  uuid(), practId, consultIds[1], patientIds[1],
  'tpl_specialiste',
  'Courrier spécialiste — radiologue',
  `Dr Jean-Baptiste MARTIN\nOstéopathe D.O.\n24 rue de la Roquette\n75011 Paris\n\nParis, le ${new Date().toLocaleDateString('fr-FR')}`,
  `Je vous adresse M. Thomas BERNARD, 44 ans, pour réalisation d'une IRM lombaire.

Ce patient consulte pour une lombalgie subaiguë évoluant depuis 10 jours avec irradiation fessière droite.

Antécédent de hernie discale L4-L5 documentée en 2019.

Cliniquement : limitation de la flexion lombaire à 60°, signe de Lasègue droit à 70° sans déficit moteur ni sensitif objectivé.

Je souhaiterais éliminer une nouvelle hernie discale ou une autre pathologie structurelle avant de poursuivre la prise en charge ostéopathique.

En vous remerciant de votre avis éclairé.`,
  'Dr Moreau',
  'Radiologue',
  `Confraternellement,\n\nDr J.-B. MARTIN\nOstéopathe D.O.`,
  now, now
)

// Survey responses
db.prepare(`
  INSERT INTO survey_responses (id, consultation_id, patient_id, practitioner_id, token, status, overall_rating, eva_score, pain_evolution, comment, would_recommend, responded_at, created_at)
  VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?)
`).run(uuid(), consultIds[6], patientIds[0], practId, uuid(), 5, 2, 'better', 'Excellente séance, douleurs très nettement diminuées. Je recommande vivement !', 1, now, now)

db.prepare(`
  INSERT INTO survey_responses (id, consultation_id, patient_id, practitioner_id, token, status, overall_rating, eva_score, pain_evolution, comment, would_recommend, responded_at, created_at)
  VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?)
`).run(uuid(), consultIds[9], patientIds[1], practId, uuid(), 4, 3, 'better', 'Bonne amélioration progressive. Merci pour les conseils.', 1, now, now)

// Manual revenue entries (last 6 months)
for (let i = 0; i < 6; i++) {
  const d = new Date()
  d.setMonth(d.getMonth() - i)
  const amount = 4500 + Math.round(Math.random() * 2000)
  db.prepare(`INSERT OR IGNORE INTO manual_revenue_entries (id, practitioner_id, year, month, amount, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(uuid(), practId, d.getFullYear(), d.getMonth() + 1, amount, now, now)
}

// Conversation + message
const convId = uuid()
db.prepare(`INSERT INTO conversations (id, practitioner_id, patient_id, subject, last_message_at, unread_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(convId, practId, patientIds[0], 'Compte-rendu — Sophie DUPONT', now, 0, now, now)
db.prepare(`INSERT INTO messages (id, conversation_id, content, direction, channel, status, sent_at, created_at) VALUES (?, ?, ?, 'outgoing', 'email', 'sent', ?, ?)`).run(uuid(), convId, 'Bonjour Mme Dupont,\n\nSuite à notre séance d\'hier, je vous envoie le compte-rendu ainsi que les exercices à pratiquer quotidiennement.\n\nBonne récupération,\nDr J.-B. Martin', now, now)

console.log('✅ Demo database seeded successfully!')
console.log(`   DB path: ${dbPath}`)
console.log(`   Practitioner: Jean-Baptiste MARTIN (user_id: ${userId})`)
console.log(`   Patients: ${patients.length}`)
console.log(`   Consultations: ${consultData.length}`)
console.log(`   Letters: 2`)
