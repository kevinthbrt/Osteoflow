-- ============================================
-- Add Google review link to practitioners
-- ============================================
ALTER TABLE practitioners
ADD COLUMN IF NOT EXISTS google_review_url TEXT;

-- ============================================
-- Allow deletion of conversations and messages
-- ============================================
CREATE POLICY "Practitioners can delete their own conversations"
  ON conversations FOR DELETE
  USING (
    practitioner_id IN (
      SELECT id FROM practitioners WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Practitioners can delete messages in their conversations"
  ON messages FOR DELETE
  USING (
    conversation_id IN (
      SELECT c.id FROM conversations c
      JOIN practitioners p ON c.practitioner_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );
