-- Migration: Medical History Entries + Statistics Views
-- Version: 1.2.0

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE medical_history_type AS ENUM ('traumatic', 'medical', 'surgical', 'family');
CREATE TYPE onset_duration_unit AS ENUM ('days', 'weeks', 'months', 'years');

-- ============================================
-- TABLES
-- ============================================

-- Medical History Entries (structured antécédents)
CREATE TABLE medical_history_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

  -- Type of history
  history_type medical_history_type NOT NULL,

  -- Description
  description TEXT NOT NULL,

  -- Onset information (only ONE should be filled)
  onset_date DATE,                              -- Option 1: Specific date
  onset_age INTEGER CHECK (onset_age >= 0),     -- Option 2: Age when it started
  onset_duration_value INTEGER CHECK (onset_duration_value > 0),  -- Option 3: Duration value
  onset_duration_unit onset_duration_unit,      -- Option 3: Duration unit

  -- Vigilance flag (important to watch)
  is_vigilance BOOLEAN DEFAULT FALSE,

  -- Optional note
  note TEXT,

  -- Order for display
  display_order INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraint: only one onset mode can be used
  CONSTRAINT onset_mode_exclusive CHECK (
    (CASE WHEN onset_date IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN onset_age IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN onset_duration_value IS NOT NULL THEN 1 ELSE 0 END) <= 1
  ),

  -- Constraint: duration value and unit must be together
  CONSTRAINT duration_complete CHECK (
    (onset_duration_value IS NULL AND onset_duration_unit IS NULL) OR
    (onset_duration_value IS NOT NULL AND onset_duration_unit IS NOT NULL)
  )
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_mhe_patient ON medical_history_entries(patient_id);
CREATE INDEX idx_mhe_type ON medical_history_entries(history_type);
CREATE INDEX idx_mhe_vigilance ON medical_history_entries(is_vigilance) WHERE is_vigilance = TRUE;
CREATE INDEX idx_mhe_patient_type ON medical_history_entries(patient_id, history_type);

-- Indexes for statistics
CREATE INDEX idx_patients_gender ON patients(gender) WHERE archived_at IS NULL;
CREATE INDEX idx_patients_birth_date ON patients(birth_date) WHERE archived_at IS NULL;
CREATE INDEX idx_consultations_reason ON consultations(reason) WHERE archived_at IS NULL;
CREATE INDEX idx_consultations_year_month ON consultations(date_part('year', date_time), date_part('month', date_time)) WHERE archived_at IS NULL;

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_medical_history_entries_updated_at
  BEFORE UPDATE ON medical_history_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE medical_history_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practitioners can view medical history of their patients"
  ON medical_history_entries FOR SELECT
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE practitioner_id = get_current_practitioner_id()
    )
  );

CREATE POLICY "Practitioners can insert medical history for their patients"
  ON medical_history_entries FOR INSERT
  WITH CHECK (
    patient_id IN (
      SELECT id FROM patients WHERE practitioner_id = get_current_practitioner_id()
    )
  );

CREATE POLICY "Practitioners can update medical history of their patients"
  ON medical_history_entries FOR UPDATE
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE practitioner_id = get_current_practitioner_id()
    )
  );

CREATE POLICY "Practitioners can delete medical history of their patients"
  ON medical_history_entries FOR DELETE
  USING (
    patient_id IN (
      SELECT id FROM patients WHERE practitioner_id = get_current_practitioner_id()
    )
  );

-- ============================================
-- STATISTICS FUNCTIONS (RPCs)
-- ============================================

-- Function to get patient statistics
CREATE OR REPLACE FUNCTION get_patient_statistics(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_gender VARCHAR DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  result JSON;
  practitioner_uuid UUID;
BEGIN
  practitioner_uuid := get_current_practitioner_id();

  WITH filtered_patients AS (
    SELECT *
    FROM patients
    WHERE practitioner_id = practitioner_uuid
      AND archived_at IS NULL
      AND (p_gender IS NULL OR gender = p_gender)
      AND (p_start_date IS NULL OR created_at >= p_start_date)
      AND (p_end_date IS NULL OR created_at <= p_end_date + INTERVAL '1 day')
  ),
  gender_stats AS (
    SELECT
      gender,
      COUNT(*) as count
    FROM filtered_patients
    GROUP BY gender
  ),
  age_stats AS (
    SELECT
      CASE
        WHEN EXTRACT(YEAR FROM age(birth_date)) < 18 THEN '0-17'
        WHEN EXTRACT(YEAR FROM age(birth_date)) < 30 THEN '18-29'
        WHEN EXTRACT(YEAR FROM age(birth_date)) < 45 THEN '30-44'
        WHEN EXTRACT(YEAR FROM age(birth_date)) < 60 THEN '45-59'
        WHEN EXTRACT(YEAR FROM age(birth_date)) < 75 THEN '60-74'
        ELSE '75+'
      END as age_group,
      COUNT(*) as count
    FROM filtered_patients
    GROUP BY age_group
  )
  SELECT json_build_object(
    'total', (SELECT COUNT(*) FROM filtered_patients),
    'by_gender', (SELECT COALESCE(json_agg(json_build_object('gender', gender, 'count', count)), '[]'::json) FROM gender_stats),
    'by_age_group', (SELECT COALESCE(json_agg(json_build_object('age_group', age_group, 'count', count)), '[]'::json) FROM age_stats)
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to get consultation statistics
CREATE OR REPLACE FUNCTION get_consultation_statistics(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_gender VARCHAR DEFAULT NULL,
  p_age_group VARCHAR DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  result JSON;
  practitioner_uuid UUID;
BEGIN
  practitioner_uuid := get_current_practitioner_id();

  WITH filtered_patients AS (
    SELECT id, birth_date
    FROM patients
    WHERE practitioner_id = practitioner_uuid
      AND archived_at IS NULL
      AND (p_gender IS NULL OR gender = p_gender)
      AND (p_age_group IS NULL OR
        CASE
          WHEN EXTRACT(YEAR FROM age(birth_date)) < 18 THEN '0-17'
          WHEN EXTRACT(YEAR FROM age(birth_date)) < 30 THEN '18-29'
          WHEN EXTRACT(YEAR FROM age(birth_date)) < 45 THEN '30-44'
          WHEN EXTRACT(YEAR FROM age(birth_date)) < 60 THEN '45-59'
          WHEN EXTRACT(YEAR FROM age(birth_date)) < 75 THEN '60-74'
          ELSE '75+'
        END = p_age_group
      )
  ),
  filtered_consultations AS (
    SELECT c.*
    FROM consultations c
    JOIN filtered_patients fp ON c.patient_id = fp.id
    WHERE c.archived_at IS NULL
      AND (p_start_date IS NULL OR c.date_time >= p_start_date)
      AND (p_end_date IS NULL OR c.date_time <= p_end_date + INTERVAL '1 day')
  ),
  monthly_stats AS (
    SELECT
      EXTRACT(YEAR FROM date_time)::INTEGER as year,
      EXTRACT(MONTH FROM date_time)::INTEGER as month,
      COUNT(*) as count
    FROM filtered_consultations
    GROUP BY year, month
    ORDER BY year, month
  ),
  reason_stats AS (
    SELECT
      LOWER(TRIM(reason)) as reason,
      COUNT(*) as count
    FROM filtered_consultations
    GROUP BY LOWER(TRIM(reason))
    ORDER BY count DESC
    LIMIT 15
  ),
  day_of_week_stats AS (
    SELECT
      EXTRACT(DOW FROM date_time)::INTEGER as day_of_week,
      COUNT(*) as count
    FROM filtered_consultations
    GROUP BY day_of_week
    ORDER BY day_of_week
  ),
  yearly_stats AS (
    SELECT
      EXTRACT(YEAR FROM date_time)::INTEGER as year,
      COUNT(*) as total_consultations,
      COUNT(DISTINCT patient_id) as unique_patients
    FROM filtered_consultations
    GROUP BY year
    ORDER BY year
  ),
  patient_frequency AS (
    SELECT
      patient_id,
      COUNT(*) as consultation_count
    FROM filtered_consultations
    GROUP BY patient_id
  )
  SELECT json_build_object(
    'total', (SELECT COUNT(*) FROM filtered_consultations),
    'unique_patients', (SELECT COUNT(DISTINCT patient_id) FROM filtered_consultations),
    'avg_per_patient', (SELECT ROUND(AVG(consultation_count)::numeric, 2) FROM patient_frequency),
    'by_month', (SELECT COALESCE(json_agg(json_build_object('year', year, 'month', month, 'count', count)), '[]'::json) FROM monthly_stats),
    'by_reason', (SELECT COALESCE(json_agg(json_build_object('reason', reason, 'count', count)), '[]'::json) FROM reason_stats),
    'by_day_of_week', (SELECT COALESCE(json_agg(json_build_object('day', day_of_week, 'count', count)), '[]'::json) FROM day_of_week_stats),
    'by_year', (SELECT COALESCE(json_agg(json_build_object('year', year, 'consultations', total_consultations, 'patients', unique_patients)), '[]'::json) FROM yearly_stats)
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to get revenue statistics
CREATE OR REPLACE FUNCTION get_revenue_statistics(
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  result JSON;
  practitioner_uuid UUID;
BEGIN
  practitioner_uuid := get_current_practitioner_id();

  WITH filtered_invoices AS (
    SELECT i.*
    FROM invoices i
    JOIN consultations c ON i.consultation_id = c.id
    JOIN patients p ON c.patient_id = p.id
    WHERE p.practitioner_id = practitioner_uuid
      AND i.status = 'paid'
      AND (p_start_date IS NULL OR i.paid_at >= p_start_date)
      AND (p_end_date IS NULL OR i.paid_at <= p_end_date + INTERVAL '1 day')
  ),
  monthly_revenue AS (
    SELECT
      EXTRACT(YEAR FROM paid_at)::INTEGER as year,
      EXTRACT(MONTH FROM paid_at)::INTEGER as month,
      SUM(amount) as total,
      COUNT(*) as count
    FROM filtered_invoices
    GROUP BY year, month
    ORDER BY year, month
  ),
  payment_methods AS (
    SELECT
      pm.method,
      SUM(pm.amount) as total
    FROM filtered_invoices fi
    JOIN payments pm ON pm.invoice_id = fi.id
    GROUP BY pm.method
  )
  SELECT json_build_object(
    'total', (SELECT COALESCE(SUM(amount), 0) FROM filtered_invoices),
    'count', (SELECT COUNT(*) FROM filtered_invoices),
    'average', (SELECT COALESCE(ROUND(AVG(amount)::numeric, 2), 0) FROM filtered_invoices),
    'by_month', (SELECT COALESCE(json_agg(json_build_object('year', year, 'month', month, 'total', total, 'count', count)), '[]'::json) FROM monthly_revenue),
    'by_payment_method', (SELECT COALESCE(json_agg(json_build_object('method', method, 'total', total)), '[]'::json) FROM payment_methods)
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- MIGRATION: Backfill existing data
-- ============================================

-- Note: This creates entries from existing TEXT fields
-- You may want to run this manually after reviewing the data

-- Function to migrate existing medical history (run once, then can be dropped)
CREATE OR REPLACE FUNCTION migrate_existing_medical_history()
RETURNS void AS $$
DECLARE
  patient_record RECORD;
BEGIN
  FOR patient_record IN
    SELECT id, trauma_history, medical_history, surgical_history, family_history
    FROM patients
    WHERE archived_at IS NULL
      AND (trauma_history IS NOT NULL OR medical_history IS NOT NULL OR surgical_history IS NOT NULL OR family_history IS NOT NULL)
  LOOP
    -- Migrate trauma history
    IF patient_record.trauma_history IS NOT NULL AND LENGTH(TRIM(patient_record.trauma_history)) > 0 THEN
      INSERT INTO medical_history_entries (patient_id, history_type, description, note)
      VALUES (patient_record.id, 'traumatic', 'Antécédents traumatiques (migré)', patient_record.trauma_history);
    END IF;

    -- Migrate medical history
    IF patient_record.medical_history IS NOT NULL AND LENGTH(TRIM(patient_record.medical_history)) > 0 THEN
      INSERT INTO medical_history_entries (patient_id, history_type, description, note)
      VALUES (patient_record.id, 'medical', 'Antécédents médicaux (migré)', patient_record.medical_history);
    END IF;

    -- Migrate surgical history
    IF patient_record.surgical_history IS NOT NULL AND LENGTH(TRIM(patient_record.surgical_history)) > 0 THEN
      INSERT INTO medical_history_entries (patient_id, history_type, description, note)
      VALUES (patient_record.id, 'surgical', 'Antécédents chirurgicaux (migré)', patient_record.surgical_history);
    END IF;

    -- Migrate family history
    IF patient_record.family_history IS NOT NULL AND LENGTH(TRIM(patient_record.family_history)) > 0 THEN
      INSERT INTO medical_history_entries (patient_id, history_type, description, note)
      VALUES (patient_record.id, 'family', 'Antécédents familiaux (migré)', patient_record.family_history);
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Uncomment to run migration:
-- SELECT migrate_existing_medical_history();

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_patient_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION get_consultation_statistics TO authenticated;
GRANT EXECUTE ON FUNCTION get_revenue_statistics TO authenticated;
