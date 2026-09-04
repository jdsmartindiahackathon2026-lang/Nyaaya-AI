-- Silence Supabase advisor INFO on public.rate_limits by declaring an
-- explicit deny-all RLS policy. The table is written to only via the
-- SECURITY DEFINER function check_rate_limit(), which bypasses RLS by
-- design. No client role should ever touch it directly.

alter table if exists public.rate_limits enable row level security;

drop policy if exists "rate_limits_no_direct_access" on public.rate_limits;

create policy "rate_limits_no_direct_access"
  on public.rate_limits
  for all
  to authenticated, anon
  using (false)
  with check (false);
