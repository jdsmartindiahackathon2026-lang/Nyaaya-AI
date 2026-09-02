-- Nyaaya AI initial schema

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  language TEXT NOT NULL CHECK (language IN ('en', 'hi', 'bn')),
  user_type TEXT NOT NULL CHECK (user_type IN ('practitioner', 'startup', 'researcher', 'cultivator')),
  jurisdiction TEXT NOT NULL CHECK (jurisdiction IN ('india', 'both', 'international')),
  context_answers JSONB DEFAULT '{}'
);

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  jurisdiction TEXT NOT NULL CHECK (jurisdiction IN ('india', 'international', 'both')),
  title TEXT
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  citations JSONB DEFAULT '[]',
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'abstain')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  query_summary TEXT NOT NULL,
  contact TEXT NOT NULL,
  urgency TEXT NOT NULL CHECK (urgency IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can only access own data" ON users
  FOR ALL USING (auth.uid() = auth_id);

CREATE POLICY "Users can only access own conversations" ON conversations
  FOR ALL USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can only access own messages" ON messages
  FOR ALL USING (conversation_id IN (
    SELECT c.id FROM conversations c
    JOIN users u ON c.user_id = u.id
    WHERE u.auth_id = auth.uid()
  ));

CREATE POLICY "Users can only access own escalations" ON escalations
  FOR ALL USING (user_id IN (SELECT id FROM users WHERE auth_id = auth.uid()));
