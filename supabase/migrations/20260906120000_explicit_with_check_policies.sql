-- L-B1: Make WITH CHECK explicit on ALL policies for conversations, escalations,
-- messages, and users. Previously WITH CHECK was NULL (functionally equivalent to
-- USING for ALL policies, but flagged by security scanners). Each policy is dropped
-- and recreated with an explicit WITH CHECK identical to its USING clause.

-- conversations
DROP POLICY IF EXISTS "Users can only access own conversations" ON public.conversations;
CREATE POLICY "Users can only access own conversations"
  ON public.conversations
  FOR ALL
  USING (
    user_id IN (
      SELECT users.id
        FROM users
       WHERE users.auth_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id IN (
      SELECT users.id
        FROM users
       WHERE users.auth_id = auth.uid()
    )
  );

-- escalations
DROP POLICY IF EXISTS "Users can only access own escalations" ON public.escalations;
CREATE POLICY "Users can only access own escalations"
  ON public.escalations
  FOR ALL
  USING (
    user_id IN (
      SELECT users.id
        FROM users
       WHERE users.auth_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id IN (
      SELECT users.id
        FROM users
       WHERE users.auth_id = auth.uid()
    )
  );

-- messages
DROP POLICY IF EXISTS "Users can only access own messages" ON public.messages;
CREATE POLICY "Users can only access own messages"
  ON public.messages
  FOR ALL
  USING (
    conversation_id IN (
      SELECT c.id
        FROM conversations c
        JOIN users u ON c.user_id = u.id
       WHERE u.auth_id = auth.uid()
    )
  )
  WITH CHECK (
    conversation_id IN (
      SELECT c.id
        FROM conversations c
        JOIN users u ON c.user_id = u.id
       WHERE u.auth_id = auth.uid()
    )
  );

-- users
DROP POLICY IF EXISTS "Users can only access own data" ON public.users;
CREATE POLICY "Users can only access own data"
  ON public.users
  FOR ALL
  USING (auth.uid() = auth_id)
  WITH CHECK (auth.uid() = auth_id);
