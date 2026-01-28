-- ============================================
-- V2: ALLOW EXTERNAL EMAILS (non-patient senders)
-- ============================================
-- Run this SQL in your Supabase SQL Editor AFTER the first migration

-- 1. Make patient_id nullable in conversations (to allow external conversations)
ALTER TABLE conversations
ALTER COLUMN patient_id DROP NOT NULL;

-- 2. Add external contact fields to conversations
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS external_email VARCHAR(255);
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS external_name VARCHAR(255);

-- 3. Add constraint: either patient_id OR external_email must be set
-- (we can't easily add this constraint without risking existing data, so we'll handle it in code)

-- 4. Create index for external email lookups
CREATE INDEX IF NOT EXISTS idx_conversations_external_email
ON conversations(practitioner_id, external_email)
WHERE external_email IS NOT NULL;

-- 5. Update RLS policy to include external conversations
-- (The existing policy should still work since it checks practitioner_id)

-- ============================================
-- VERIFICATION (optional)
-- ============================================
-- SELECT column_name, is_nullable, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'conversations';
