/**
 * SQLite schema for MyOsteoFlow desktop application.
 * Converted from the Supabase/PostgreSQL schema.
 * UUIDs are stored as TEXT, timestamps as TEXT (ISO 8601), booleans as INTEGER (0/1).
 */

import { randomUUID } from 'crypto'

export const SCHEMA_SQL = `
-- Practitioners (replaces auth.users + practitioners)
CREATE TABLE IF NOT EXISTS practitioners (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
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
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Patients
CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  practitioner_id TEXT NOT NULL REFERENCES practitioners(id),
  gender TEXT NOT NULL CHECK (gender IN ('M', 'F')),
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
  referred_by_patient_id TEXT REFERENCES patients(id),
  referred_by_source TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  archived_at TEXT
);

-- Session types
CREATE TABLE IF NOT EXISTS session_types (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  practitioner_id TEXT NOT NULL REFERENCES practitioners(id),
  name TEXT NOT NULL,
  price REAL NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Consultations
CREATE TABLE IF NOT EXISTS consultations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  patient_id TEXT NOT NULL REFERENCES patients(id),
  date_time TEXT NOT NULL DEFAULT (datetime('now')),
  reason TEXT NOT NULL,
  anamnesis TEXT,
  examination TEXT,
  advice TEXT,
  follow_up_7d INTEGER DEFAULT 0,
  follow_up_sent_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  archived_at TEXT,
  session_type_id TEXT REFERENCES session_types(id)
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  consultation_id TEXT NOT NULL UNIQUE REFERENCES consultations(id),
  invoice_number TEXT NOT NULL UNIQUE,
  amount REAL NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'paid', 'cancelled')),
  issued_at TEXT,
  paid_at TEXT,
  pdf_url TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  invoice_id TEXT NOT NULL REFERENCES invoices(id),
  amount REAL NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('card', 'cash', 'check', 'transfer', 'other')),
  payment_date TEXT NOT NULL DEFAULT (date('now')),
  check_number TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  practitioner_id TEXT NOT NULL REFERENCES practitioners(id),
  patient_id TEXT REFERENCES patients(id),
  subject TEXT,
  last_message_at TEXT DEFAULT (datetime('now')),
  unread_count INTEGER DEFAULT 0,
  is_archived INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  external_email TEXT,
  external_name TEXT
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  conversation_id TEXT NOT NULL REFERENCES conversations(id),
  content TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'outgoing' CHECK (direction IN ('incoming', 'outgoing')),
  channel TEXT NOT NULL DEFAULT 'internal' CHECK (channel IN ('internal', 'email', 'sms')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'delivered', 'read', 'failed')),
  consultation_id TEXT REFERENCES consultations(id),
  sent_at TEXT,
  delivered_at TEXT,
  read_at TEXT,
  email_subject TEXT,
  email_message_id TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  external_email_id TEXT,
  from_email TEXT,
  to_email TEXT
);

-- Email settings
CREATE TABLE IF NOT EXISTS email_settings (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  practitioner_id TEXT NOT NULL UNIQUE REFERENCES practitioners(id),
  smtp_host TEXT NOT NULL,
  smtp_port INTEGER NOT NULL DEFAULT 587,
  smtp_secure INTEGER NOT NULL DEFAULT 0,
  smtp_user TEXT NOT NULL,
  smtp_password TEXT NOT NULL,
  imap_host TEXT NOT NULL,
  imap_port INTEGER NOT NULL DEFAULT 993,
  imap_secure INTEGER NOT NULL DEFAULT 1,
  imap_user TEXT NOT NULL,
  imap_password TEXT NOT NULL,
  from_name TEXT,
  from_email TEXT NOT NULL,
  last_sync_at TEXT,
  last_sync_uid INTEGER DEFAULT 0,
  sync_enabled INTEGER NOT NULL DEFAULT 1,
  is_verified INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  last_error_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Email templates
CREATE TABLE IF NOT EXISTS email_templates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  practitioner_id TEXT NOT NULL REFERENCES practitioners(id),
  type TEXT NOT NULL CHECK (type IN ('invoice', 'follow_up_7d')),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Message templates
CREATE TABLE IF NOT EXISTS message_templates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  practitioner_id TEXT NOT NULL REFERENCES practitioners(id),
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  use_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Scheduled tasks
CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  practitioner_id TEXT NOT NULL REFERENCES practitioners(id),
  type TEXT NOT NULL CHECK (type IN ('follow_up_email')),
  consultation_id TEXT REFERENCES consultations(id),
  scheduled_for TEXT NOT NULL,
  executed_at TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  practitioner_id TEXT REFERENCES practitioners(id),
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data TEXT,
  new_data TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Saved reports
CREATE TABLE IF NOT EXISTS saved_reports (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  practitioner_id TEXT NOT NULL REFERENCES practitioners(id),
  name TEXT NOT NULL,
  filters TEXT NOT NULL DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Medical history entries
CREATE TABLE IF NOT EXISTS medical_history_entries (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  patient_id TEXT NOT NULL REFERENCES patients(id),
  history_type TEXT NOT NULL CHECK (history_type IN ('traumatic', 'medical', 'surgical', 'family')),
  description TEXT NOT NULL,
  onset_date TEXT,
  onset_age INTEGER CHECK (onset_age >= 0),
  onset_duration_value INTEGER CHECK (onset_duration_value > 0),
  onset_duration_unit TEXT CHECK (onset_duration_unit IN ('days', 'weeks', 'months', 'years')),
  is_vigilance INTEGER DEFAULT 0,
  note TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Consultation attachments
CREATE TABLE IF NOT EXISTS consultation_attachments (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  consultation_id TEXT NOT NULL REFERENCES consultations(id),
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT,
  file_size INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Exercise prescription templates (reusable programmes)
CREATE TABLE IF NOT EXISTS exercise_prescription_templates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  practitioner_id TEXT NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Exercise prescription template items
CREATE TABLE IF NOT EXISTS exercise_prescription_template_items (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  template_id TEXT NOT NULL REFERENCES exercise_prescription_templates(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  exercise_description TEXT NOT NULL,
  exercise_region TEXT NOT NULL,
  exercise_type TEXT NOT NULL,
  exercise_level INTEGER NOT NULL DEFAULT 1,
  illustration_url TEXT,
  nerve_target TEXT,
  progression_regression TEXT,
  sets INTEGER,
  reps TEXT,
  hold_time INTEGER,
  rest_time INTEGER,
  frequency TEXT,
  notes TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Exercise prescriptions
CREATE TABLE IF NOT EXISTS exercise_prescriptions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  consultation_id TEXT REFERENCES consultations(id),
  title TEXT NOT NULL DEFAULT 'Programme de rééducation',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Exercise prescription items
CREATE TABLE IF NOT EXISTS exercise_prescription_items (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  prescription_id TEXT NOT NULL REFERENCES exercise_prescriptions(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  exercise_description TEXT NOT NULL,
  exercise_region TEXT NOT NULL,
  exercise_type TEXT NOT NULL,
  exercise_level INTEGER NOT NULL DEFAULT 1,
  illustration_url TEXT,
  nerve_target TEXT,
  progression_regression TEXT,
  sets INTEGER,
  reps TEXT,
  hold_time INTEGER,
  rest_time INTEGER,
  frequency TEXT,
  notes TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_exercise_prescription_templates_practitioner ON exercise_prescription_templates(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_exercise_prescription_template_items_template ON exercise_prescription_template_items(template_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_patients_practitioner ON patients(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_patients_archived ON patients(archived_at);
CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(last_name COLLATE NOCASE, first_name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);
CREATE INDEX IF NOT EXISTS idx_patients_email ON patients(email COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_patients_updated ON patients(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_consultations_patient ON consultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_consultations_patient_date ON consultations(patient_id, date_time DESC);
CREATE INDEX IF NOT EXISTS idx_consultations_datetime ON consultations(date_time);
CREATE INDEX IF NOT EXISTS idx_invoices_consultation ON invoices(consultation_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_conversations_practitioner ON conversations(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_status ON scheduled_tasks(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_medical_history_patient ON medical_history_entries(patient_id);
CREATE INDEX IF NOT EXISTS idx_consultation_attachments_consultation ON consultation_attachments(consultation_id);
CREATE INDEX IF NOT EXISTS idx_exercise_prescriptions_patient ON exercise_prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_exercise_prescription_items_prescription ON exercise_prescription_items(prescription_id);

-- Survey responses (J+7 patient satisfaction surveys)
CREATE TABLE IF NOT EXISTS survey_responses (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  consultation_id TEXT NOT NULL REFERENCES consultations(id),
  patient_id TEXT NOT NULL REFERENCES patients(id),
  practitioner_id TEXT NOT NULL REFERENCES practitioners(id),
  token TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
  eva_score INTEGER CHECK (eva_score BETWEEN 0 AND 10),
  pain_reduction INTEGER,
  better_mobility INTEGER,
  pain_evolution TEXT CHECK (pain_evolution IN ('better', 'same', 'worse')),
  comment TEXT,
  would_recommend INTEGER,
  responded_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  synced_at TEXT,
  acknowledged_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_survey_responses_token ON survey_responses(token);
CREATE INDEX IF NOT EXISTS idx_survey_responses_consultation ON survey_responses(consultation_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_practitioner ON survey_responses(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_status ON survey_responses(status);

-- App config table (for storing current practitioner, etc.)
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Manual revenue entries (for months before using the app)
CREATE TABLE IF NOT EXISTS manual_revenue_entries (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  practitioner_id TEXT NOT NULL REFERENCES practitioners(id),
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(practitioner_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_manual_revenue_practitioner ON manual_revenue_entries(practitioner_id, year);

-- Generated letters (AI-drafted communication documents)
CREATE TABLE IF NOT EXISTS generated_letters (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
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
CREATE INDEX IF NOT EXISTS idx_generated_letters_practitioner ON generated_letters(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_generated_letters_consultation ON generated_letters(consultation_id);

-- Custom clinical content (tests & manipulations) for @mention
CREATE TABLE IF NOT EXISTS custom_clinical_content (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
  practitioner_id TEXT NOT NULL REFERENCES practitioners(id),
  content_type TEXT NOT NULL CHECK (content_type IN ('test', 'technique')),
  name TEXT NOT NULL,
  description TEXT,
  region TEXT,
  sort_order INTEGER DEFAULT 0,
  use_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_custom_clinical_content_practitioner ON custom_clinical_content(practitioner_id, content_type);

`

/**
 * Run safe migrations that add columns if they don't already exist.
 * Called after the main schema is executed.
 */
export function runMigrations(db: { exec: (sql: string) => void; pragma: (sql: string) => unknown; prepare?(sql: string): { get(...args: never[]): unknown } }) {
  // Add check_number to payments
  const paymentCols = db.pragma('table_info(payments)') as Array<{ name: string }>
  if (!paymentCols.some((c) => c.name === 'check_number')) {
    db.exec('ALTER TABLE payments ADD COLUMN check_number TEXT;')
  }

  // Add password_hash to practitioners
  const practCols = db.pragma('table_info(practitioners)') as Array<{ name: string }>
  if (!practCols.some((c) => c.name === 'password_hash')) {
    db.exec('ALTER TABLE practitioners ADD COLUMN password_hash TEXT;')
  }

  // Add post-session advice columns to consultations
  const consultCols = db.pragma('table_info(consultations)') as Array<{ name: string }>
  if (!consultCols.some((c) => c.name === 'send_post_session_advice')) {
    db.exec('ALTER TABLE consultations ADD COLUMN send_post_session_advice INTEGER DEFAULT 0;')
  }
  if (!consultCols.some((c) => c.name === 'post_session_advice_sent_at')) {
    db.exec('ALTER TABLE consultations ADD COLUMN post_session_advice_sent_at TEXT;')
  }

  // Add status to practitioners
  if (!practCols.some((c) => c.name === 'status')) {
    db.exec('ALTER TABLE practitioners ADD COLUMN status TEXT;')
  }

  // Add objectives columns to practitioners
  const practCols2 = db.pragma('table_info(practitioners)') as Array<{ name: string }>
  if (!practCols2.some((c) => c.name === 'annual_revenue_objective')) {
    db.exec('ALTER TABLE practitioners ADD COLUMN annual_revenue_objective REAL;')
  }
  if (!practCols2.some((c) => c.name === 'vacation_weeks_per_year')) {
    db.exec('ALTER TABLE practitioners ADD COLUMN vacation_weeks_per_year INTEGER DEFAULT 5;')
  }
  if (!practCols2.some((c) => c.name === 'working_days_per_week')) {
    db.exec('ALTER TABLE practitioners ADD COLUMN working_days_per_week INTEGER DEFAULT 4;')
  }
  if (!practCols2.some((c) => c.name === 'average_consultation_price')) {
    db.exec('ALTER TABLE practitioners ADD COLUMN average_consultation_price REAL;')
  }

  // Add referred_by_patient_id to patients
  const patientCols = db.pragma('table_info(patients)') as Array<{ name: string }>
  if (!patientCols.some((c) => c.name === 'referred_by_patient_id')) {
    db.exec('ALTER TABLE patients ADD COLUMN referred_by_patient_id TEXT REFERENCES patients(id);')
  }
  if (!patientCols.some((c) => c.name === 'pregnancy_due_date')) {
    db.exec('ALTER TABLE patients ADD COLUMN pregnancy_due_date TEXT;')
  }
  if (!patientCols.some((c) => c.name === 'referred_by_source')) {
    db.exec('ALTER TABLE patients ADD COLUMN referred_by_source TEXT;')
  }

  // Add new survey fields (eva_score, pain_reduction, better_mobility, acknowledged_at)
  const surveyCols = db.pragma('table_info(survey_responses)') as Array<{ name: string }>
  if (!surveyCols.some((c) => c.name === 'eva_score')) {
    db.exec('ALTER TABLE survey_responses ADD COLUMN eva_score INTEGER CHECK (eva_score BETWEEN 0 AND 10);')
  }
  if (!surveyCols.some((c) => c.name === 'pain_reduction')) {
    db.exec('ALTER TABLE survey_responses ADD COLUMN pain_reduction INTEGER;')
  }
  if (!surveyCols.some((c) => c.name === 'better_mobility')) {
    db.exec('ALTER TABLE survey_responses ADD COLUMN better_mobility INTEGER;')
  }
  if (!surveyCols.some((c) => c.name === 'acknowledged_at')) {
    db.exec('ALTER TABLE survey_responses ADD COLUMN acknowledged_at TEXT;')
  }

  // Create manual_revenue_entries table if not exists (already in SCHEMA_SQL for new installs)
  db.exec(`
    CREATE TABLE IF NOT EXISTS manual_revenue_entries (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
      practitioner_id TEXT NOT NULL REFERENCES practitioners(id),
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(practitioner_id, year, month)
    );
  `)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_manual_revenue_practitioner ON manual_revenue_entries(practitioner_id, year);`)

  // Add configurable follow-up delay to practitioners
  const practFollowUpCols = db.pragma('table_info(practitioners)') as Array<{ name: string }>
  if (!practFollowUpCols.some((c) => c.name === 'follow_up_delay_days')) {
    db.exec('ALTER TABLE practitioners ADD COLUMN follow_up_delay_days INTEGER NOT NULL DEFAULT 7;')
  }
  if (!practFollowUpCols.some((c) => c.name === 'profession')) {
    db.exec("ALTER TABLE practitioners ADD COLUMN profession TEXT DEFAULT 'osteopathe';")
  }
  if (!practFollowUpCols.some((c) => c.name === 'vat_regime')) {
    db.exec("ALTER TABLE practitioners ADD COLUMN vat_regime TEXT DEFAULT 'exempt_261';")
  }
  // Etiopathe registration numbers (used instead of RPPS)
  if (!practFollowUpCols.some((c) => c.name === 'rpe')) {
    db.exec('ALTER TABLE practitioners ADD COLUMN rpe TEXT;')
  }
  if (!practFollowUpCols.some((c) => c.name === 'rne')) {
    db.exec('ALTER TABLE practitioners ADD COLUMN rne TEXT;')
  }

  // Message attachments — files attached to sent/received messages
  db.exec(`
    CREATE TABLE IF NOT EXISTS message_attachments (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
      message_id TEXT REFERENCES messages(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
      file_size INTEGER NOT NULL DEFAULT 0,
      data BLOB NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_message_attachments_message ON message_attachments(message_id);`)

  // Exercise prescriptions tables (idempotent via IF NOT EXISTS)
  db.exec(`
    CREATE TABLE IF NOT EXISTS exercise_prescriptions (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      consultation_id TEXT REFERENCES consultations(id),
      title TEXT NOT NULL DEFAULT 'Programme de rééducation',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
  db.exec(`
    CREATE TABLE IF NOT EXISTS exercise_prescription_items (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
      prescription_id TEXT NOT NULL REFERENCES exercise_prescriptions(id) ON DELETE CASCADE,
      exercise_id TEXT NOT NULL,
      exercise_name TEXT NOT NULL,
      exercise_description TEXT NOT NULL,
      exercise_region TEXT NOT NULL,
      exercise_type TEXT NOT NULL,
      exercise_level INTEGER NOT NULL DEFAULT 1,
      illustration_url TEXT,
      sets INTEGER,
      reps TEXT,
      hold_time INTEGER,
      rest_time INTEGER,
      frequency TEXT,
      notes TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_exercise_prescriptions_patient ON exercise_prescriptions(patient_id);`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_exercise_prescription_items_prescription ON exercise_prescription_items(prescription_id);`)

  // Exercise prescription templates (idempotent via IF NOT EXISTS)
  db.exec(`
    CREATE TABLE IF NOT EXISTS exercise_prescription_templates (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
      practitioner_id TEXT NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
  db.exec(`
    CREATE TABLE IF NOT EXISTS exercise_prescription_template_items (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
      template_id TEXT NOT NULL REFERENCES exercise_prescription_templates(id) ON DELETE CASCADE,
      exercise_id TEXT NOT NULL,
      exercise_name TEXT NOT NULL,
      exercise_description TEXT NOT NULL,
      exercise_region TEXT NOT NULL,
      exercise_type TEXT NOT NULL,
      exercise_level INTEGER NOT NULL DEFAULT 1,
      illustration_url TEXT,
      sets INTEGER,
      reps TEXT,
      hold_time INTEGER,
      rest_time INTEGER,
      frequency TEXT,
      notes TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_exercise_prescription_templates_practitioner ON exercise_prescription_templates(practitioner_id);`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_exercise_prescription_template_items_template ON exercise_prescription_template_items(template_id);`)

  // Add nerve_target and progression_regression to exercise prescription items
  const prescItemCols = db.pragma('table_info(exercise_prescription_items)') as Array<{ name: string }>
  if (!prescItemCols.some((c) => c.name === 'nerve_target')) {
    db.exec('ALTER TABLE exercise_prescription_items ADD COLUMN nerve_target TEXT;')
  }
  if (!prescItemCols.some((c) => c.name === 'progression_regression')) {
    db.exec('ALTER TABLE exercise_prescription_items ADD COLUMN progression_regression TEXT;')
  }

  const tmplItemCols = db.pragma('table_info(exercise_prescription_template_items)') as Array<{ name: string }>
  if (!tmplItemCols.some((c) => c.name === 'nerve_target')) {
    db.exec('ALTER TABLE exercise_prescription_template_items ADD COLUMN nerve_target TEXT;')
  }
  if (!tmplItemCols.some((c) => c.name === 'progression_regression')) {
    db.exec('ALTER TABLE exercise_prescription_template_items ADD COLUMN progression_regression TEXT;')
  }

  // Generated letters table (AI communication module)
  db.exec(`
    CREATE TABLE IF NOT EXISTS generated_letters (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6)))),
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
  `)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_generated_letters_practitioner ON generated_letters(practitioner_id);`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_generated_letters_consultation ON generated_letters(consultation_id);`)

  // Add closing column to generated_letters (existing installs)
  const lettersCols = db.pragma('table_info(generated_letters)') as Array<{ name: string }>
  if (!lettersCols.some((c) => c.name === 'closing')) {
    db.exec('ALTER TABLE generated_letters ADD COLUMN closing TEXT;')
  }

  // Clear legacy flat history fields — idempotent, superseded by medical_history_entries
  db.exec('UPDATE patients SET surgical_history = NULL, trauma_history = NULL, medical_history = NULL, family_history = NULL;')

  // Normalize existing patient last names to uppercase
  db.exec("UPDATE patients SET last_name = UPPER(last_name) WHERE last_name != UPPER(last_name);")

  // Migrate custom_clinical_content: fix CHECK constraint ('manipulation'→'technique') + add use_count.
  // SQLite can't ALTER CHECK constraints, so we inspect CREATE SQL via sqlite_master and rebuild.
  const customClinicalCols = db.pragma('table_info(custom_clinical_content)') as Array<{ name: string }>
  if (customClinicalCols.length > 0) {
    let needsRebuild = !customClinicalCols.some((c) => c.name === 'use_count')
    if (!needsRebuild && db.prepare) {
      const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='custom_clinical_content'").get() as { sql?: string } | undefined
      if ((row?.sql || '').includes("'manipulation'")) needsRebuild = true
    }
    if (needsRebuild) {
      db.exec(`CREATE TABLE IF NOT EXISTS custom_clinical_content_v2 (
        id TEXT PRIMARY KEY,
        practitioner_id TEXT NOT NULL REFERENCES practitioners(id),
        content_type TEXT NOT NULL CHECK (content_type IN ('test', 'technique')),
        name TEXT NOT NULL,
        description TEXT,
        region TEXT,
        sort_order INTEGER DEFAULT 0,
        use_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`)
      db.exec(`INSERT OR IGNORE INTO custom_clinical_content_v2
        SELECT id, practitioner_id,
          CASE content_type WHEN 'manipulation' THEN 'technique' ELSE content_type END,
          name, description, region, sort_order, 0, created_at, updated_at
        FROM custom_clinical_content`)
      db.exec(`DROP TABLE custom_clinical_content`)
      db.exec(`ALTER TABLE custom_clinical_content_v2 RENAME TO custom_clinical_content`)
    }
  }

  // Add patient-facing fields to exercise prescriptions
  const prescNewCols = db.pragma('table_info(exercise_prescriptions)') as Array<{ name: string }>
  if (!prescNewCols.some((c) => c.name === 'patient_intro')) {
    db.exec('ALTER TABLE exercise_prescriptions ADD COLUMN patient_intro TEXT;')
  }
  if (!prescNewCols.some((c) => c.name === 'vigilance_points')) {
    db.exec('ALTER TABLE exercise_prescriptions ADD COLUMN vigilance_points TEXT;')
  }
  if (!prescNewCols.some((c) => c.name === 'weekly_routine')) {
    db.exec('ALTER TABLE exercise_prescriptions ADD COLUMN weekly_routine TEXT;')
  }
  if (!prescNewCols.some((c) => c.name === 'clinical_notes')) {
    db.exec('ALTER TABLE exercise_prescriptions ADD COLUMN clinical_notes TEXT;')
  }

  // ── Multi-cabinet ─────────────────────────────────────────────────────────
  // Un "cabinet" = une ligne practitioners (qui porte déjà nom/adresse/SIRET…).
  // owner_id regroupe les cabinets d'un même propriétaire (pour le partage).
  // cabinet_id attribue consultations/factures au cabinet qui les a créées,
  // afin de pouvoir cloisonner (par défaut) ou partager (sur option).
  const dbp = db as unknown as { prepare?(sql: string): { get(...a: unknown[]): unknown; all(...a: unknown[]): unknown; run(...a: unknown[]): unknown } }

  // 1) Ajout des colonnes (idempotent via garde sur l'existence).
  const practColsMC = db.pragma('table_info(practitioners)') as Array<{ name: string }>
  if (!practColsMC.some((c) => c.name === 'owner_id')) {
    db.exec('ALTER TABLE practitioners ADD COLUMN owner_id TEXT;')
    db.exec('CREATE INDEX IF NOT EXISTS idx_practitioners_owner ON practitioners(owner_id);')
  }
  const consultColsMC = db.pragma('table_info(consultations)') as Array<{ name: string }>
  if (!consultColsMC.some((c) => c.name === 'cabinet_id')) {
    db.exec('ALTER TABLE consultations ADD COLUMN cabinet_id TEXT;')
    db.exec('CREATE INDEX IF NOT EXISTS idx_consultations_cabinet ON consultations(cabinet_id);')
  }
  const invColsMC = db.pragma('table_info(invoices)') as Array<{ name: string }>
  if (!invColsMC.some((c) => c.name === 'cabinet_id')) {
    db.exec('ALTER TABLE invoices ADD COLUMN cabinet_id TEXT;')
    db.exec('CREATE INDEX IF NOT EXISTS idx_invoices_cabinet ON invoices(cabinet_id);')
  }

  // 2) Rétro-attribution IDEMPOTENTE (rejouée à chaque démarrage tant que des
  //    lignes ne sont pas attribuées). Indispensable pour réparer les bases où
  //    une version antérieure de cette migration a échoué en cours de route.
  if (dbp.prepare) {
    // Propriétaire unique et stable pour tous les cabinets de l'installation.
    const ownerRow = dbp.prepare("SELECT value FROM app_config WHERE key = 'cabinet_owner_id'").get() as { value?: string } | undefined
    const existingOwner = dbp.prepare('SELECT owner_id FROM practitioners WHERE owner_id IS NOT NULL LIMIT 1').get() as { owner_id?: string } | undefined
    const ownerId = ownerRow?.value || existingOwner?.owner_id || randomUUID()
    if (!ownerRow?.value) {
      dbp.prepare("INSERT OR REPLACE INTO app_config (key, value) VALUES ('cabinet_owner_id', ?)").run(ownerId)
    }
    dbp.prepare('UPDATE practitioners SET owner_id = ? WHERE owner_id IS NULL').run(ownerId)

    // Patients sans cabinet (legacy/import) → cabinet principal (le plus ancien).
    const principal = dbp.prepare('SELECT id FROM practitioners ORDER BY created_at ASC LIMIT 1').get() as { id?: string } | undefined
    if (principal?.id) {
      dbp.prepare("UPDATE patients SET practitioner_id = ? WHERE practitioner_id IS NULL OR practitioner_id = ''").run(principal.id)
    }
    // Consultation → cabinet du patient ; Facture → cabinet de la consultation.
    dbp.prepare('UPDATE consultations SET cabinet_id = (SELECT p.practitioner_id FROM patients p WHERE p.id = consultations.patient_id) WHERE cabinet_id IS NULL').run()
    dbp.prepare('UPDATE invoices SET cabinet_id = (SELECT c.cabinet_id FROM consultations c WHERE c.id = invoices.consultation_id) WHERE cabinet_id IS NULL').run()
  }
}

/**
 * Boolean fields that need conversion between SQLite (0/1) and JS (true/false).
 */
export const BOOLEAN_FIELDS: Record<string, string[]> = {
  consultations: ['follow_up_7d', 'send_post_session_advice'],
  session_types: ['is_active'],
  conversations: ['is_archived'],
  email_settings: ['smtp_secure', 'imap_secure', 'sync_enabled', 'is_verified'],
  medical_history_entries: ['is_vigilance'],
  survey_responses: ['would_recommend'],
}

/**
 * JSON fields stored as TEXT in SQLite that need parsing.
 */
export const JSON_FIELDS: Record<string, string[]> = {
  audit_logs: ['old_data', 'new_data'],
  saved_reports: ['filters'],
}
