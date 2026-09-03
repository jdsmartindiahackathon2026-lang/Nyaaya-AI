# Context — Nyaaya AI / IP-SAKTI

_Last updated: Session 6 — 2026-09-03_

---

## Current state

4-screen onboarding flow (Language → Who Are You → Context Questions → Session Summary) shipped on branch `feature/onboarding-4-screens` (PR #5, open). Fixed a silent bug where the `users` upsert was writing a non-existent `preferred_language` column and leaving `auth_id` NULL — which RLS would reject; profile writes now land correctly and are isolated per user. Jurisdiction hardcoded to India end-to-end. Next session: real login/signup screens replacing `signInAnonymously`.

| Layer | Status |
|---|---|
| Frontend (Next.js 14) | ✅ Complete — 3-column shell, all pages, opening splash, tree/leaves, 4-screen onboarding |
| Onboarding profile writes | ✅ Fixed — writes `{id, auth_id, user_type, language, jurisdiction, context_answers}` |
| RLS isolation | ✅ Verified — all 4 public tables enforce `auth.uid()`-scoped policies |
| Frontend conversation history | ✅ Sends last 6 turns to `ask-query` |
| Edge Functions (code) | ✅ All 6 hardened — auth, CORS, structured outputs |
| Edge Functions (deployed) | ⚠️ Old versions still ACTIVE on Supabase — redeploy after PR merge |
| Shared helpers | ✅ `_shared/auth.ts`, `_shared/cors.ts` |
| DB Schema | ✅ Applied — 4 tables with RLS |
| API Keys (Perplexity, Groq) | ❌ Not yet set in Supabase Secrets |
| `ALLOWED_ORIGINS` env var | ❌ Not set (defaults to `http://localhost:3000` if omitted) |
| Rate limiting | ❌ Not implemented |
| Vercel deployment | ❌ Not configured |
| Login/signup screens | ❌ Anon-only today — planned for Session 7 |
| `rls_auto_enable()` SECURITY DEFINER | ⚠️ Advisor WARN — revoke EXECUTE in a future migration |

---

## Edge Functions (all deployed — ACTIVE, but code has moved ahead of deploy)

| Function | File | Calls | Notes |
|---|---|---|---|
| `ask-query` | `supabase/functions/ask-query/index.ts` | Perplexity Sonar API | sonar-pro with 400/402/403/429 fallback to sonar; module-level `sonarProAvailable` flag; validated `history` (last 6); explicit `CONFIDENCE` parsing |
| `classify-formulation` | `supabase/functions/classify-formulation/index.ts` | Perplexity Sonar API | Structured `display_name \| url \| statute_ref` citations |
| `tkdl-search` | `supabase/functions/tkdl-search/index.ts` | Perplexity Sonar API | JSON array of up to 5 records; graceful fallback |
| `mini-guide` | `supabase/functions/mini-guide/index.ts` | Groq Llama 3.3-70b | Prompt-in-target-language (en/hi/ta/bn) |
| `translate` | `supabase/functions/translate/index.ts` | Google Translate API | Body-once fix; correct `targetLanguage` echo on failure |
| `escalate` | `supabase/functions/escalate/index.ts` | Supabase DB write only | `user_id` from JWT |

Deploy command:
```
supabase functions deploy ask-query classify-formulation tkdl-search mini-guide translate escalate --project-ref nrsfljvrtsnewkbufdid
```

---

## Secrets status

| Secret | Status |
|---|---|
| `PERPLEXITY_API_KEY` | ❌ Set before deploy |
| `GROQ_API_KEY` | ❌ Set before deploy |
| `GOOGLE_TRANSLATE_API_KEY` | ✅ Added (Session 3) |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-available in Edge Functions |
| `ALLOWED_ORIGINS` | ❌ Optional — omit for dev-only default `http://localhost:3000`; set to comma-separated list once Vercel domain is live |

---

## Auth model (as of Session 5)

- Every Edge Function calls `requireUser(req)` immediately after the OPTIONS check.
- Accepts:
  - Any valid Supabase JWT (anonymous session from `signInAnonymously` OR future authenticated session)
  - Service-role key (internal function-to-function calls, e.g. `ask-query → translate`) — mapped to synthetic `{ id: 'system', is_service_role: true }` user
- Rejects: missing header, malformed header, invalid/expired JWT → 401 `{ error: true, code: 'UNAUTHORIZED', ... }`
- When the real login screen replaces `signInAnonymously()` with `signInWithPassword` / OAuth, zero backend change needed — `supabase.functions.invoke()` auto-attaches whatever session token exists.

## CORS model

- Env var `ALLOWED_ORIGINS`, comma-separated. Default: `http://localhost:3000`.
- Request `Origin` echoed only if in the list; otherwise falls back to the first allowlisted origin (blocks disallowed origins from receiving the CORS grant).
- `Vary: Origin` set on every response.

## Confidence & Citations format (ask-query)

Model output structure (all stripped from user-facing answer):
```
<answer text>
CONFIDENCE: <HIGH|MEDIUM|ABSTAIN>
CITATIONS:
Display Name | https://url | Section/Article ref
Display Name 2 | https://url2 | Section ref 2
Information, not legal advice. Verify against the official record before filing.
```

Parsing:
- `CONFIDENCE` line matched by `/^CONFIDENCE:\s*(HIGH|MEDIUM|ABSTAIN)\b/im`; missing → `medium`
- `CITATIONS:` block parsed by pipe-splitter with URL validation; raw Perplexity URLs are the fallback

---

## Open decisions

- **Rate limiting:** Not implemented. Add before public/demo exposure. Simple in-function counter vs. Supabase `pg_cron` vs. Upstash Redis.
- **DB-backed conversation persistence:** deferred. Frontend still sends `conversationId: null`; the `ask-query` DB write is dead code but harmless. Revisit alongside login screen.
- **Landing page:** `frontend/landing-page.html` is separate static HTML for the hackathon submission — not part of the Next.js app.
- **ABS Helper:** Static decision tree. `abs_helper` filter set exists in `approved_sources.json` if wired later.
- **Architecture framing:** Live retrieval via Perplexity Sonar with domain filtering — NOT a true RAG. Do not describe as RAG to judges. Correct: "live retrieval with approved-source filtering."
- **Schema drift:** DB `users.language` CHECK allows only `('en','hi','bn')` but frontend also offers Tamil (`ta`). Migration needed if we keep the check constraint. Session 6.

---

## Frontend env vars needed for Vercel

```
NEXT_PUBLIC_SUPABASE_URL=https://nrsfljvrtsnewkbufdid.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from Supabase dashboard>
```

---

## Supabase DB tables

- `users` — anonymous user profiles (language, jurisdiction, userType)
- `conversations` — session grouping (unused by ask-query currently)
- `messages` — Q&A records (dead code path in ask-query — gated on `conversationId`)
- `escalations` — human escalation requests

All tables have RLS enabled.
