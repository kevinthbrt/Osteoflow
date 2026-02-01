/**
 * SQLite schema for Osteoflow desktop application.
 * Converted from the Supabase/PostgreSQL schema.
 * UUIDs are stored as TEXT, timestamps as TEXT (ISO 8601), booleans as INTEGER (0/1).
 */

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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_patients_practitioner ON patients(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_patients_archived ON patients(archived_at);
CREATE INDEX IF NOT EXISTS idx_consultations_patient ON consultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_consultations_datetime ON consultations(date_time);
CREATE INDEX IF NOT EXISTS idx_invoices_consultation ON invoices(consultation_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_conversations_practitioner ON conversations(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_status ON scheduled_tasks(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_medical_history_patient ON medical_history_entries(patient_id);

-- App config table (for storing current practitioner, etc.)
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

`

/**
 * Run safe migrations that add columns if they don't already exist.
 * Called after the main schema is executed.
 */
export function runMigrations(db: { exec: (sql: string) => void; pragma: (sql: string) => Array<Record<string, unknown>> }) {
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
}

/**
 * JSON fields stored as TEXT in SQLite that need parsing.
 */
export const JSON_FIELDS: Record<string, string[]> = {
  audit_logs: ['old_data', 'new_data'],
  saved_reports: ['filters'],
}
