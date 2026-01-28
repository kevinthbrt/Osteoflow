-- ============================================
-- EMAIL SETTINGS TABLE FOR SMTP/IMAP CONFIGURATION
-- ============================================
-- Run this SQL in your Supabase SQL Editor
-- Dashboard > SQL Editor > New Query > Paste & Run

-- 1. Create the email_settings table
CREATE TABLE IF NOT EXISTS email_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    practitioner_id UUID NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,

    -- SMTP Configuration (for sending)
    smtp_host VARCHAR(255) NOT NULL,
    smtp_port INTEGER NOT NULL DEFAULT 587,
    smtp_secure BOOLEAN NOT NULL DEFAULT false, -- true for 465, false for other ports
    smtp_user VARCHAR(255) NOT NULL,
    smtp_password VARCHAR(255) NOT NULL, -- App password (encrypted at rest by Supabase)

    -- IMAP Configuration (for receiving)
    imap_host VARCHAR(255) NOT NULL,
    imap_port INTEGER NOT NULL DEFAULT 993,
    imap_secure BOOLEAN NOT NULL DEFAULT true, -- true for SSL
    imap_user VARCHAR(255) NOT NULL,
    imap_password VARCHAR(255) NOT NULL, -- App password (same as SMTP usually)

    -- Email identity
    from_name VARCHAR(255), -- Display name (e.g., "Dr. Dupont - Cabinet Ostéo")
    from_email VARCHAR(255) NOT NULL, -- Email address

    -- IMAP sync settings
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_sync_uid BIGINT DEFAULT 0, -- Last processed email UID to avoid duplicates
    sync_enabled BOOLEAN NOT NULL DEFAULT true,

    -- Connection status
    is_verified BOOLEAN NOT NULL DEFAULT false,
    last_error TEXT,
    last_error_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- One config per practitioner
    CONSTRAINT unique_practitioner_email_settings UNIQUE (practitioner_id)
);

-- 2. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_settings_practitioner ON email_settings(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_email_settings_sync_enabled ON email_settings(sync_enabled) WHERE sync_enabled = true;

-- 3. Enable Row Level Security
ALTER TABLE email_settings ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies - Practitioners can only access their own settings

-- Policy for SELECT
CREATE POLICY "Practitioners can view their own email settings"
ON email_settings
FOR SELECT
USING (
    practitioner_id IN (
        SELECT id FROM practitioners WHERE user_id = auth.uid()
    )
);

-- Policy for INSERT
CREATE POLICY "Practitioners can create their own email settings"
ON email_settings
FOR INSERT
WITH CHECK (
    practitioner_id IN (
        SELECT id FROM practitioners WHERE user_id = auth.uid()
    )
);

-- Policy for UPDATE
CREATE POLICY "Practitioners can update their own email settings"
ON email_settings
FOR UPDATE
USING (
    practitioner_id IN (
        SELECT id FROM practitioners WHERE user_id = auth.uid()
    )
)
WITH CHECK (
    practitioner_id IN (
        SELECT id FROM practitioners WHERE user_id = auth.uid()
    )
);

-- Policy for DELETE
CREATE POLICY "Practitioners can delete their own email settings"
ON email_settings
FOR DELETE
USING (
    practitioner_id IN (
        SELECT id FROM practitioners WHERE user_id = auth.uid()
    )
);

-- 5. Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_email_settings_updated_at
    BEFORE UPDATE ON email_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_email_settings_updated_at();

-- 6. Add column to messages table for tracking inbound emails
ALTER TABLE messages ADD COLUMN IF NOT EXISTS external_email_id VARCHAR(255);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS from_email VARCHAR(255);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS to_email VARCHAR(255);

-- Index for deduplication of inbound emails
CREATE INDEX IF NOT EXISTS idx_messages_external_email_id ON messages(external_email_id) WHERE external_email_id IS NOT NULL;

-- ============================================
-- VERIFICATION QUERY (optional - run to check)
-- ============================================
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'email_settings';
