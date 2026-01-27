-- Messages Schema for Patient Communication
-- Version: 1.1.0

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE message_status AS ENUM ('draft', 'sent', 'delivered', 'failed');
CREATE TYPE message_direction AS ENUM ('outgoing', 'incoming');
CREATE TYPE message_channel AS ENUM ('email', 'sms', 'internal');

-- ============================================
-- TABLES
-- ============================================

-- Conversations (thread with a patient)
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

  -- Conversation metadata
  subject VARCHAR(255),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  unread_count INTEGER DEFAULT 0,
  is_archived BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint per practitioner-patient pair
  UNIQUE(practitioner_id, patient_id)
);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

  -- Message content
  content TEXT NOT NULL,
  direction message_direction NOT NULL DEFAULT 'outgoing',
  channel message_channel NOT NULL DEFAULT 'internal',
  status message_status NOT NULL DEFAULT 'draft',

  -- Related to consultation (optional)
  consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,

  -- Metadata
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,

  -- For email messages
  email_subject VARCHAR(255),
  email_message_id VARCHAR(255),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quick responses / Templates
CREATE TABLE message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES practitioners(id) ON DELETE CASCADE,

  name VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(50),

  -- Usage tracking
  use_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_conversations_practitioner ON conversations(practitioner_id);
CREATE INDEX idx_conversations_patient ON conversations(patient_id);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX idx_conversations_unread ON conversations(practitioner_id, unread_count) WHERE unread_count > 0;

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_consultation ON messages(consultation_id) WHERE consultation_id IS NOT NULL;

CREATE INDEX idx_message_templates_practitioner ON message_templates(practitioner_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

-- Conversations policies
CREATE POLICY "Practitioners can view their own conversations"
  ON conversations FOR SELECT
  USING (
    practitioner_id IN (
      SELECT id FROM practitioners WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Practitioners can create conversations"
  ON conversations FOR INSERT
  WITH CHECK (
    practitioner_id IN (
      SELECT id FROM practitioners WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Practitioners can update their own conversations"
  ON conversations FOR UPDATE
  USING (
    practitioner_id IN (
      SELECT id FROM practitioners WHERE user_id = auth.uid()
    )
  );

-- Messages policies
CREATE POLICY "Practitioners can view messages in their conversations"
  ON messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT c.id FROM conversations c
      JOIN practitioners p ON c.practitioner_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Practitioners can create messages in their conversations"
  ON messages FOR INSERT
  WITH CHECK (
    conversation_id IN (
      SELECT c.id FROM conversations c
      JOIN practitioners p ON c.practitioner_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "Practitioners can update their own messages"
  ON messages FOR UPDATE
  USING (
    conversation_id IN (
      SELECT c.id FROM conversations c
      JOIN practitioners p ON c.practitioner_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );

-- Message templates policies
CREATE POLICY "Practitioners can view their own templates"
  ON message_templates FOR SELECT
  USING (
    practitioner_id IN (
      SELECT id FROM practitioners WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Practitioners can manage their own templates"
  ON message_templates FOR ALL
  USING (
    practitioner_id IN (
      SELECT id FROM practitioners WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- TRIGGERS
-- ============================================

-- Update conversation's last_message_at when a new message is created
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET
    last_message_at = NEW.created_at,
    unread_count = CASE
      WHEN NEW.direction = 'incoming' THEN unread_count + 1
      ELSE unread_count
    END,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_message_created
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_last_message();

-- Update timestamps
CREATE TRIGGER update_conversations_timestamp
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_message_templates_timestamp
  BEFORE UPDATE ON message_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
