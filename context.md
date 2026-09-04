# Context — Nyaaya AI / IP-SAKTI

_Last updated: Session 9 — 2026-09-04_

---

## Current state

Hybrid RAG **ingest layer** shipped in Session 9. PR [#10](https://github.com/jdsmartindiahackathon2026-lang/Nyaaya-AI/pull/10) merged to `main`. Offline pipeline scrapes IndiaCode + arbitrary PDFs, chunks per-clause with hierarchical IDs, embeds locally with `bge-small-en-v1.5`. **Corpus: 19 sources / 7,438 chunks / 2.13M chars of Indian legal text.** Retrieval quality verified — flagship queries hit exact clauses (BD Rules §14 at 0.836 for ABS, TRIPS §39, Phytopharma §2 definition). **No runtime code touched yet** — this PR is offline tooling + data only. Next: pgvector migration + `load.py` + hybrid retrieval Edge Function (the wiring PR). Everything else from Session 8 still holds — ABS Wizard live, all 6 Edge Functions v2 ACTIVE, Google OAuth working. Ask/TKDL/Classify-citations still 503 until Joyjit sets `PERPLEXITY_API_KEY`.

| Layer | Status |
|---|---|
| Frontend (Next.js 14) | ✅ Complete — 3-column shell, all pages, 4-screen onboarding, opening splash |
| Login / auth wiring | ✅ /login + /auth/callback + session gate + sign-out |
| Google OAuth | ✅ Provider enabled in Supabase; end-to-end tested |
| Email/password auth | ✅ Signup, sign-in, resetPasswordForEmail all wired |
| Password hashing | ✅ Handled by Supabase auth (bcrypt in `auth.users.encrypted_password`) |
| Onboarding profile writes | ✅ Writes `{id, auth_id, user_type, language, jurisdiction, context_answers}` — RLS-safe |
| RLS isolation | ✅ Verified — all 4 public tables enforce `auth.uid()`-scoped policies |
| Frontend conversation history | ✅ Sends last 6 turns to `ask-query` |
| Edge Functions (code) | ✅ All 6 hardened — auth, CORS, structured outputs |
| Edge Functions (deployed) | ✅ All 6 redeployed to v2 ACTIVE (Session 7, via Supabase MCP) |
| Rate limiting | ✅ Live — per-user-per-minute caps via Postgres RPC. Caps: Ask/Classify/TKDL=20, mini-guide=30, translate=60, escalate=5 |
| Shared helpers | ✅ `_shared/auth.ts`, `_shared/cors.ts` |
| DB Schema | ✅ Applied — 4 tables with RLS |
| `GROQ_API_KEY` | ✅ Set (Session 7 — mini-guide works end-to-end) |
| `PERPLEXITY_API_KEY` | ❌ Not yet set — Ask/TKDL/Classify-citations return 503 until Joyjit adds it |
| `ALLOWED_ORIGINS` env var | ❌ Not set (defaults to `http://localhost:3000` if omitted) |
| Rate limiting | ❌ Not implemented |
| Vercel deployment | ❌ Not configured |
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

## Auth model (as of Session 6)

- Every Edge Function calls `requireUser(req)` immediately after the OPTIONS check.
- Accepts:
  - Any valid Supabase JWT (email/password, Google OAuth, or leftover anon sessions)
  - Service-role key (internal function-to-function calls, e.g. `ask-query → translate`) — mapped to synthetic `{ id: 'system', is_service_role: true }` user
- Rejects: missing header, malformed header, invalid/expired JWT → 401 `{ error: true, code: 'UNAUTHORIZED', ... }`
- Frontend flow: `/` → session check → `/login` (no session) OR `/onboarding` (session but no `public.users` row) OR `/app/ask` (session + profile). `/app/*` layout enforces the same gate with an `onAuthStateChange` listener so sign-out anywhere bounces to `/login`.
- Passwords: raw pw never touches our code beyond the `supabase.auth.signUp` / `signInWithPassword` calls. Bcrypt hash lives in `auth.users.encrypted_password` — private schema, not queryable from the app.

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
- **Schema drift:** ✅ Resolved Session 7. `users.language` CHECK now accepts `('en','hi','bn','ta')`.
- **ABS Wizard:** design PDF delivered Session 7 (`scratchpad/ABS_Wizard_Design.pdf`). Build pending user go-ahead. Would turn the static /app/abs reference into a branching diagnostic ending in a personalised checklist. Fully client-side, zero API cost.
- **Screen report for SIH presenters:** delivered Session 7 (`scratchpad/Nyaaya_AI_Screen_Report.pdf`). 13 pages — every screen + judge FAQ + honest limitations.

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
- `abs_diagnoses` — one row per ABS Wizard completion (`answers`, `obligations`, `obligation_count`). Latest read via `ORDER BY created_at DESC LIMIT 1`. Never overwritten — retake = new row. Establishes the pattern for future per-feature result tables.
- `rate_limits` — per-user-per-minute counters (Session 7).

All tables have RLS enabled.

**Pending (Session 10):**
- `statute_chunks` table with `vector(384)` column, pgvector extension, similarity-search RPC, RLS. Loaded from `scraped/chunks/*.embedded.jsonl` by `ingest/load.py`.

---

## Hybrid RAG (offline ingest, shipped Session 9)

- **Pipeline:** `ingest/scrape.py` (IndiaCode DSpace) or `ingest/scrape_pdf.py` (arbitrary PDF) → `ingest/chunk.py` or `chunk_pdf.py` → `ingest/embed.py`. Outputs `scraped/chunks/<id>.jsonl` (committed) + `<id>.embedded.jsonl` (gitignored, ~7MB per act).
- **Corpus:** 19 sources, 7,438 chunks. See `progress.md` Session 9 for the full list.
- **Embedding model:** `BAAI/bge-small-en-v1.5` — 384-dim, MIT, MTEB-top in its size class. Runs on CPU in ~4 min for the whole corpus. Query prefix `"query: "` required at retrieval time; passages get none.
- **Chunk shape** (identical for both ingest paths):
  ```
  { statute_id, statute_display, section_number, section_title, clause_id,
    text, page_number, citation_url, deep_link, [embedding] }
  ```
- **Deep links:** `<pdf_url>#page=N` — W3C-standard PDF viewer fragment. Every browser opens the source PDF at the exact page.
- **Not yet in corpus:** FSSAI Ayurveda-Aahara Regs 2022 (URL not confirmed), BD Rules 2025 amendment (uuid `0ea74615-6957-4ef2-aea6-765fbc3f6750` — should add for freshness).
- **Local dev env note:** `sentence-transformers` on Windows Python 3.13 needs a short-path venv (e.g. `C:\rv`) — torch dist-info exceeds Windows' 260-char path limit inside system `site-packages`.

---

## ABS Wizard (`/app/abs`)

- **Pure logic:** `frontend/lib/abs_logic.ts` — 5-question matrix, `nextQuestion()` branching (Q1=No skips Q2/Q3/Q4), `deriveObligations()`, `buildResult()`, `buildAskQuery()`, `buildEscalateSummary()`.
- **UI:** `frontend/app/app/abs/page.tsx` — `useReducer` state machine (`loading|start|question|result`), progress bar, live counter with `gooeyIn` tick-up, confetti on completion, actions: Save / Download PDF / Escalate / Ask about this / Retake.
- **PDF export:** `frontend/components/ABSMemoPDF.tsx` — lazy-loaded jsPDF (`@4.2.1`), A4 black-on-white memo.
- **Persistence:** save is opt-in. On revisit, latest saved diagnosis loads directly into the memo screen; Retake starts a fresh run. Always rebuild `AbsResult` from stored `answers` (never trust stored `obligations`) so logic updates propagate.
- **Deep-links:** memo → `/app/ask?q=<question>` auto-sends; memo → `/app/escalate?summary=<text>&issueType=ABS+clearance+guidance` pre-fills.
- **Cost:** zero API calls. Runs even if Edge Functions are down.
