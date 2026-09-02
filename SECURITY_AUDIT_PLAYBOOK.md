# Security Audit Playbook — Nyaaya AI

**Who this applies to:** any AI agent auditing this project.

**Golden rule: verify against the LIVE system, not just the repo.** Static analysis will scream about vulnerabilities already fixed in production and miss ones only live queries reveal. A repo is a claim; the running system is the truth.

**Project identifiers (single source of truth — update HERE first if these change):**
- Supabase project ID: `nrsfljvrtsnewkbufdid` (ap-southeast-1)
- Repo: `jdsmartindiahackathon2026-lang/Nyaaya-AI`; correct auth account: `jdsmartindiahackathon2026-lang`
- Deploy platform: Vercel (frontend); Supabase (Edge Functions)
- Verified commit email: `jdsmartindiahackathon2026@gmail.com`

---

## 0. Before you start

1. Read `CLAUDE.md`, `context.md`, and the latest `progress.md` block. Do not re-report what prior audits already fixed; do not re-suggest what is deliberately deferred.
2. Confirm access to the live Supabase project and the repo remote. If a tool returns "permission denied" or "not found", say so loudly and mark those areas **UNVERIFIED**.
3. Fan out in parallel: one auditor per surface (frontend, Edge Functions/DB, repo/perimeter). Auditors are read-only. Fixes come later on branches, never on main.

---

## 1. Frontend audit (Next.js)

- **Identity:** every write to Supabase must use the client SDK's auth session — never derive user identity from route params, localStorage, component state, or request bodies.
- **Secrets:** only `NEXT_PUBLIC_*` variables may appear in client code. Grep for `PERPLEXITY`, `GROQ`, `GOOGLE_TRANSLATE`, `service_role` in the `frontend/` bundle — any hit is a CRITICAL leak.
- **Dev tool logs:** check `frontend/.next/` and any log directories — they have leaked `.env` values in the past.
- **Storage at rest:** `localStorage` holds only onboarding temp values (`temp_language`, `temp_userType`, `temp_jurisdiction`, `temp_contextAnswers`) — non-sensitive UI state. Session tokens belong to the Supabase auth SDK's own storage only.
- **`.env.local` not committed:** run `git log --diff-filter=A --all -- "*.env*"` — any hit is CRITICAL.
- **Misc sweep:** no `eval()`, no `http://` (must be `https://`), no logging of tokens or PII, CSP headers configured in Vercel.

---

## 2. Backend / database audit

Run these LIVE against the Supabase catalogs, not against migration files:

```sql
-- Every table must have row security on:
SELECT relname, relrowsecurity FROM pg_class
WHERE relnamespace='public'::regnamespace AND relkind='r';

-- Every policy ownership-scoped, WITH CHECK on writes:
SELECT tablename, policyname, cmd, roles::text, qual, with_check
FROM pg_policies WHERE schemaname='public';

-- SECURITY DEFINER inventory:
SELECT p.proname, pg_get_function_identity_arguments(p.oid), p.proconfig
FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.prosecdef;

-- Storage policies:
SELECT policyname, cmd, qual, with_check
FROM pg_policies WHERE schemaname='storage';
```

Then judge:

- All 4 tables (`users`, `conversations`, `messages`, `escalations`) must show `relrowsecurity = true`.
- RLS policies must enforce the `auth.uid()` ownership chain all the way down (user → conversation → message).
- No anonymous-callable DB function that takes a user ID without self-guarding against the authenticated identity.
- Supabase anonymous auth is in use — anon paths have no user ID to key rate limits on; watch for abuse vectors on the Edge Functions.

### Edge Function inventory (refresh every audit)

| Function | Purpose | Auth token verified? | Rate limited? | In repo? |
|---|---|---|---|---|
| `ask-query` | Perplexity query + whitelist | Via Supabase client header | No — add before launch | Yes |
| `classify-formulation` | Formulation classification | Via Supabase client header | No — add before launch | Yes |
| `tkdl-search` | TKDL prior art search | Via Supabase client header | No — add before launch | Yes |
| `mini-guide` | Groq UI guide bot | Via Supabase client header | No — add before launch | Yes |
| `translate` | Google Translate | Internal only | N/A | Yes |
| `escalate` | Save escalation to DB | Via Supabase client header | No — add before launch | Yes |

**Known gap:** Rate limiting is not implemented on any Edge Function. This must be added before the hackathon demo to prevent abuse during judging.

### Payments audit

N/A — no payments in scope for hackathon demo.

---

## 3. Repo / perimeter audit

- **Secrets in repo and history:**
  ```bash
  git log --diff-filter=A --all -- "*.env*"
  git log --all -S "eyJhbGciOi" --pickaxe-regex
  git log --all -S "service_role" --pickaxe-regex
  ```
  Any hit is CRITICAL — rotate the exposed key immediately, then report.

- **`.gitignore` coverage:** verify `.env`, `.env.local`, `.env*.local`, `frontend/.env.local` are all listed.

- **Dependencies:**
  ```bash
  cd frontend && npm audit --omit=dev
  ```
  Triage by where the code runs: runtime RCE/exfil is signal; build-tooling issues are noise.

- **Branch protection:** `main` should require PR review before merge. Verify in GitHub repo settings.

---

## 4. Reporting standard

- Severity = exploitability × blast radius, judged against the LIVE system.
- Every finding: severity, file:line or object name, concrete exploit scenario, and the fix.
- Report what you verified CLEAN with the same rigor.
- No speculative findings — if you didn't read the code or query the catalog, it goes in "unverified".
- **Critical findings jump the queue** — labelled CRITICAL at the top with a fix already on a branch.

---

## 5. Fix protocol

- New branch per fix stream (`fix/…`), never main.
- DB fixes go through named migrations via Supabase MCP tool; verify with a test query, then clean up test rows.
- Deploying an Edge Function is a production change — call it out explicitly.
- Update `context.md` and `progress.md` at session end.
