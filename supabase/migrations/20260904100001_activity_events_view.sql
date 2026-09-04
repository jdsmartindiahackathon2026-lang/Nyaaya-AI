-- Migration: activity_events_v view with security_invoker for RLS passthrough

CREATE OR REPLACE VIEW public.activity_events_v AS
SELECT id, user_id, 'conversation'::text AS event_type, coalesce(title, 'Untitled conversation') AS label, created_at
FROM public.conversations
UNION ALL
SELECT id, user_id, 'abs_diagnosis'::text, 'ABS diagnosis run'::text, created_at
FROM public.abs_diagnoses
UNION ALL
SELECT id, user_id, 'escalation'::text, coalesce(query_summary, 'Escalation'), created_at
FROM public.escalations;

ALTER VIEW public.activity_events_v SET (security_invoker = true);
