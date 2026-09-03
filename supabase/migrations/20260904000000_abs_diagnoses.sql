CREATE TABLE public.abs_diagnoses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  answers JSONB NOT NULL,
  obligations JSONB NOT NULL,
  obligation_count INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX abs_diagnoses_user_id_created_at_idx
  ON public.abs_diagnoses (user_id, created_at DESC);

ALTER TABLE public.abs_diagnoses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own abs_diagnoses" ON public.abs_diagnoses
  FOR ALL
  USING (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));
