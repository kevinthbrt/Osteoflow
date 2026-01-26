-- Osteoflow Database Schema
-- Version: 1.0.0
-- This migration creates the complete schema for the osteopathy practice management app

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE invoice_status AS ENUM ('draft', 'issued', 'paid', 'cancelled');
CREATE TYPE payment_method AS ENUM ('card', 'cash', 'check', 'transfer', 'other');
CREATE TYPE email_template_type AS ENUM ('invoice', 'follow_up_7d');
CREATE TYPE task_status AS ENUM ('pending', 'completed', 'failed', 'cancelled');
CREATE TYPE task_type AS ENUM ('follow_up_email');
CREATE TYPE audit_action AS ENUM ('INSERT', 'UPDATE', 'DELETE');

-- ============================================
-- TABLES
-- ============================================

-- Practitioners (linked to auth.users)
CREATE TABLE practitioners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Personal info
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),

  -- Practice info
  practice_name VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  postal_code VARCHAR(10),
  siret VARCHAR(14),

  -- Invoice settings
  default_rate DECIMAL(10, 2) DEFAULT 60.00,
  invoice_prefix VARCHAR(20) DEFAULT 'FACT',
  invoice_next_number INTEGER DEFAULT 1,

  -- Customization
  logo_url TEXT,
  primary_color VARCHAR(7) DEFAULT '#2563eb',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Patients
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,

  -- Identification
  gender VARCHAR(1) NOT NULL CHECK (gender IN ('M', 'F')),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  birth_date DATE NOT NULL,

  -- Contact
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255),

  -- Professional
  profession VARCHAR(100),

  -- Medical history (potentially encrypted)
  trauma_history TEXT,
  medical_history TEXT,
  surgical_history TEXT,
  family_history TEXT,

  -- Notes
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  archived_at TIMESTAMPTZ DEFAULT NULL,

  -- Full-text search
  search_vector TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('french', coalesce(first_name, '')), 'A') ||
    setweight(to_tsvector('french', coalesce(last_name, '')), 'A') ||
    setweight(to_tsvector('french', coalesce(phone, '')), 'B') ||
    setweight(to_tsvector('french', coalesce(email, '')), 'B')
  ) STORED
);

-- Consultations
CREATE TABLE consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

  -- Date/time
  date_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Clinical content (potentially encrypted)
  reason VARCHAR(500) NOT NULL,
  anamnesis TEXT,
  examination TEXT,
  advice TEXT,

  -- Follow-up
  follow_up_7d BOOLEAN DEFAULT FALSE,
  follow_up_sent_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  archived_at TIMESTAMPTZ DEFAULT NULL
);

-- Invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id UUID UNIQUE NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,

  -- Number
  invoice_number VARCHAR(50) UNIQUE NOT NULL,

  -- Amount
  amount DECIMAL(10, 2) NOT NULL,

  -- Status
  status invoice_status DEFAULT 'draft',

  -- Dates
  issued_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,

  -- PDF (optional)
  pdf_url TEXT,

  -- Notes
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,

  -- Payment details
  amount DECIMAL(10, 2) NOT NULL,
  method payment_method NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Notes
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email templates
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,

  -- Template
  type email_template_type NOT NULL,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(practitioner_id, type)
);

-- Scheduled tasks
CREATE TABLE scheduled_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,

  -- Task
  type task_type NOT NULL,
  consultation_id UUID REFERENCES consultations(id) ON DELETE CASCADE,

  -- Schedule
  scheduled_for TIMESTAMPTZ NOT NULL,
  executed_at TIMESTAMPTZ,

  -- Status
  status task_status DEFAULT 'pending',
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID REFERENCES practitioners(id) ON DELETE SET NULL,

  -- Reference
  table_name VARCHAR(50) NOT NULL,
  record_id UUID NOT NULL,
  action audit_action NOT NULL,

  -- Data
  old_data JSONB,
  new_data JSONB,

  -- Context
  ip_address INET,
  user_agent TEXT,

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saved reports
CREATE TABLE saved_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,

  -- Content
  name VARCHAR(100) NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_practitioners_user_id ON practitioners(user_id);
CREATE INDEX idx_patients_practitioner ON patients(practitioner_id);
CREATE INDEX idx_patients_search ON patients USING GIN(search_vector);
CREATE INDEX idx_patients_name ON patients(last_name, first_name);
CREATE INDEX idx_patients_archived ON patients(archived_at) WHERE archived_at IS NULL;
CREATE INDEX idx_consultations_patient ON consultations(patient_id);
CREATE INDEX idx_consultations_date ON consultations(date_time DESC);
CREATE INDEX idx_consultations_follow_up ON consultations(follow_up_7d, date_time) WHERE follow_up_7d = TRUE AND follow_up_sent_at IS NULL;
CREATE INDEX idx_invoices_consultation ON invoices(consultation_id);
CREATE INDEX idx_invoices_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_issued ON invoices(issued_at DESC);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_payments_date ON payments(payment_date DESC);
CREATE INDEX idx_payments_method ON payments(method);
CREATE INDEX idx_email_templates_practitioner ON email_templates(practitioner_id);
CREATE INDEX idx_scheduled_tasks_status ON scheduled_tasks(status, scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_scheduled_tasks_practitioner ON scheduled_tasks(practitioner_id);
CREATE INDEX idx_audit_logs_practitioner ON audit_logs(practitioner_id);
CREATE INDEX idx_audit_logs_table ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX idx_saved_reports_practitioner ON saved_reports(practitioner_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Get current practitioner ID
CREATE OR REPLACE FUNCTION get_current_practitioner_id()
RETURNS UUID AS $$
  SELECT id FROM practitioners WHERE user_id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  practitioner_uuid UUID;
BEGIN
  -- Get practitioner_id based on table
  IF TG_TABLE_NAME = 'practitioners' THEN
    practitioner_uuid := COALESCE(NEW.id, OLD.id);
  ELSIF TG_TABLE_NAME = 'patients' THEN
    practitioner_uuid := COALESCE(NEW.practitioner_id, OLD.practitioner_id);
  ELSIF TG_TABLE_NAME = 'consultations' THEN
    SELECT practitioner_id INTO practitioner_uuid
    FROM patients
    WHERE id = COALESCE(NEW.patient_id, OLD.patient_id);
  ELSIF TG_TABLE_NAME = 'invoices' THEN
    SELECT p.practitioner_id INTO practitioner_uuid
    FROM consultations c
    JOIN patients p ON c.patient_id = p.id
    WHERE c.id = COALESCE(NEW.consultation_id, OLD.consultation_id);
  ELSIF TG_TABLE_NAME = 'payments' THEN
    SELECT p.practitioner_id INTO practitioner_uuid
    FROM invoices i
    JOIN consultations c ON i.consultation_id = c.id
    JOIN patients p ON c.patient_id = p.id
    WHERE i.id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  END IF;

  INSERT INTO audit_logs (
    practitioner_id,
    table_name,
    record_id,
    action,
    old_data,
    new_data
  ) VALUES (
    practitioner_uuid,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP::audit_action,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGERS
-- ============================================

-- Updated_at triggers
CREATE TRIGGER update_practitioners_updated_at
  BEFORE UPDATE ON practitioners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_consultations_updated_at
  BEFORE UPDATE ON consultations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Audit triggers
CREATE TRIGGER audit_patients
  AFTER INSERT OR UPDATE OR DELETE ON patients
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_consultations
  AFTER INSERT OR UPDATE OR DELETE ON consultations
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_invoices
  AFTER INSERT OR UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS
ALTER TABLE practitioners ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;

-- Practitioners policies
CREATE POLICY "Users can view their own practitioner profile"
  ON practitioners FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own practitioner profile"
  ON practitioners FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their practitioner profile"
  ON practitioners FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Patients policies
CREATE POLICY "Practitioners can view their own patients"
  ON patients FOR SELECT
  USING (practitioner_id = get_current_practitioner_id());

CREATE POLICY "Practitioners can insert their own patients"
  ON patients FOR INSERT
  WITH CHECK (practitioner_id = get_current_practitioner_id());

CREATE POLICY "Practitioners can update their own patients"
  ON patients FOR UPDATE
  USING (practitioner_id = get_current_practitioner_id());

CREATE POLICY "Practitioners can delete their own patients"
  ON patients FOR DELETE
  USING (practitioner_id = get_current_practitioner_id());

-- Consultations policies
CREATE POLICY "Practitioners can view consultations of their patients"
  ON consultations FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE practitioner_id = get_current_practitioner_id()
    )
  );

CREATE POLICY "Practitioners can insert consultations for their patients"
  ON consultations FOR INSERT
  WITH CHECK (
    patient_id IN (
      SELECT id FROM patients WHERE practitioner_id = get_current_practitioner_id()
    )
  );

CREATE POLICY "Practitioners can update consultations of their patients"
  ON consultations FOR UPDATE
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE practitioner_id = get_current_practitioner_id()
    )
  );

CREATE POLICY "Practitioners can delete consultations of their patients"
  ON consultations FOR DELETE
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE practitioner_id = get_current_practitioner_id()
    )
  );

-- Invoices policies
CREATE POLICY "Practitioners can view invoices of their consultations"
  ON invoices FOR SELECT
  USING (
    consultation_id IN (
      SELECT c.id FROM consultations c
      JOIN patients p ON c.patient_id = p.id
      WHERE p.practitioner_id = get_current_practitioner_id()
    )
  );

CREATE POLICY "Practitioners can insert invoices for their consultations"
  ON invoices FOR INSERT
  WITH CHECK (
    consultation_id IN (
      SELECT c.id FROM consultations c
      JOIN patients p ON c.patient_id = p.id
      WHERE p.practitioner_id = get_current_practitioner_id()
    )
  );

CREATE POLICY "Practitioners can update invoices of their consultations"
  ON invoices FOR UPDATE
  USING (
    consultation_id IN (
      SELECT c.id FROM consultations c
      JOIN patients p ON c.patient_id = p.id
      WHERE p.practitioner_id = get_current_practitioner_id()
    )
  );

-- Payments policies
CREATE POLICY "Practitioners can manage payments of their invoices"
  ON payments FOR ALL
  USING (
    invoice_id IN (
      SELECT i.id FROM invoices i
      JOIN consultations c ON i.consultation_id = c.id
      JOIN patients p ON c.patient_id = p.id
      WHERE p.practitioner_id = get_current_practitioner_id()
    )
  );

-- Email templates policies
CREATE POLICY "Practitioners can manage their email templates"
  ON email_templates FOR ALL
  USING (practitioner_id = get_current_practitioner_id());

-- Scheduled tasks policies
CREATE POLICY "Practitioners can manage their scheduled tasks"
  ON scheduled_tasks FOR ALL
  USING (practitioner_id = get_current_practitioner_id());

-- Audit logs policies (read only)
CREATE POLICY "Practitioners can view their audit logs"
  ON audit_logs FOR SELECT
  USING (practitioner_id = get_current_practitioner_id());

-- Saved reports policies
CREATE POLICY "Practitioners can manage their saved reports"
  ON saved_reports FOR ALL
  USING (practitioner_id = get_current_practitioner_id());

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Grant permissions on tables
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Grant permissions on sequences
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
