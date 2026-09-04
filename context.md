# Context — Nyaaya AI / IP-SAKTI

_Last updated: Session 10 — 2026-09-04_

---

## Current state

Hybrid RAG **runtime** shipped in Session 10. PR [#12](https://github.com/jdsmartindiahackathon2026-lang/Nyaaya-AI/pull/12) on branch `feature/hybrid-rag-runtime`. Full query path is live: user query → `embed-query` Edge Function (`bge-small-en-v1.5` via `@huggingface/transformers` v3 in Deno) → `match_statute_chunks` pgvector RPC (HNSW cosine, 384-dim) → hits ≥ 0.65 → grounded Sonar synthesis with chunk-derived citations and `#page=` deep-links. Falls back to live Perplexity when cosine < threshold or embed/RPC fail. `ask-query`, `classify-formulation`, and `tkdl-search` are all v3 hybrid. Offline ingest pipeline (`ingest/load.py`) executed at session close — **`statute_chunks` table holds 7,438 rows across 19 sources**, verified via Supabase MCP. Hybrid RAG runtime is HOT. Two blockers remain: PR #12 not yet merged, and `PERPLEXITY_API_KEY` still unset (Ask/TKDL/Classify-citations still 503 for fallback path + LLM synthesis on hybrid path).

| Layer | Status |
|---|---|
| Hybrid RAG runtime | ✅ Shipped Session 10 — embed-query + pgvector + match_statute_chunks RPC + all 3 knowledge Edge Fns hybridized |
| Frontend (Next.js 14) | ✅ Complete — 3-column shell, all pages, 4-screen onboarding, opening splash |
| Login / auth wiring | ✅ /login + /auth/callback + session gate + sign-out |
| Google OAuth | ✅ Provider enabled in Supabase; end-to-end tested |
| Email/password auth | ✅ Signup, sign-in, resetPasswordForEmail all wired |
| Password hashing | ✅ Handled by Supabase auth (bcrypt in `auth.users.encrypted_password`) |
| Onboarding profile writes | ✅ Writes `{id, auth_id, user_type, language, jurisdiction, context_answers}` — RLS-safe |
| RLS isolation | ✅ Verified — all 4 public tables enforce `auth.uid()`-scoped policies |
| Frontend conversation history | ✅ Sends last 6 turns to `ask-query` |
| Edge Functions (code) | ✅ All 6 hardened — auth, CORS, structured outputs |
| Edge Functions (deployed) | ✅ 7 functions ACTIVE — ask-query/classify/tkdl are v3 hybrid; embed-query v1 new; mini-guide/translate/escalate unchanged |
| pgvector `statute_chunks` | ✅ Seeded — 7,438 rows across 19 sources; HNSW cosine index, `match_statute_chunks` RPC, RLS all live |
| Rate limiting | ✅ Live — per-user-per-minute caps via Postgres RPC. Caps: Ask/Classify/TKDL=20, mini-guide=30, translate=60, escalate=5, embed-query=60 |
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
| `embed-query` | `supabase/functions/embed-query/index.ts` | `@huggingface/transformers` v3 (Deno) | Model `Xenova/bge-small-en-v1.5` quantized; 384-dim output; cold start 5-15s, warm ~150ms; rate limit 60/min |
| `ask-query` | `supabase/functions/ask-query/index.ts` | embed-query → pgvector → Perplexity Sonar | v3 hybrid: local RAG → grounded synthesis (no domain filter); fallback to live Perplexity when cosine < 0.65 or embed/RPC fail; `model_used` reports hybrid-rag+sonar[-pro] or sonar[-pro] |
| `classify-formulation` | `supabase/functions/classify-formulation/index.ts` | embed-query → pgvector → Perplexity Sonar | v3 hybrid: retrieval from label + innovationType + TK flag; skip Perplexity if hits ≥ 0.65; `model_used` added |
| `tkdl-search` | `supabase/functions/tkdl-search/index.ts` | embed-query → pgvector + Perplexity Sonar | v3 hybrid: Promise.all(RAG framing, Perplexity TKDL records); threshold 0.60; filter `[patents-act-1970, bd-act-2002, bd-rules-2004]`; response gains `legal_context`; if Perplexity fails → `results: []` no 503 |
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

- `statute_chunks` — 7,438 per-clause chunk records with `vector(384)` embedding column. HNSW cosine index. `match_statute_chunks(query_embedding, match_threshold, match_count)` RPC. RLS: authenticated read. **Migration applied to remote. Table is empty until Joyjit runs `python ingest/load.py`.**

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

## Hybrid RAG runtime (shipped Session 10)

**Query flow:**
1. Frontend calls `ask-query` (or `classify-formulation` / `tkdl-search`) with user query + JWT.
2. Edge Function calls `embed-query` with the raw query string.
3. `embed-query` runs `Xenova/bge-small-en-v1.5` (ONNX quantized, Deno) → returns 384-dim float array. Cold start 5-15s; warm ~150ms.
4. Edge Function calls `match_statute_chunks(query_embedding, threshold, count)` RPC on Supabase Postgres (pgvector HNSW cosine).
5. **If hits ≥ threshold:** build grounded prompt with chunk `text` as context; call Perplexity Sonar without domain filter or `return_citations`; citations built from chunk `deep_link` + `citation_url` fields. `model_used: "hybrid-rag+sonar-pro"`.
6. **Else (zero qualifying hits, or embed/RPC error):** unchanged pure-Perplexity path. `model_used: "sonar-pro"` (or `sonar`).

**Thresholds:** 0.65 for `ask-query` + `classify-formulation`; 0.60 for `tkdl-search` (short botanical queries bias toward lower scores).

**`tkdl-search` extra:** runs RAG and Perplexity in `Promise.all`. Response gains `legal_context` array (statute chunks). If Perplexity fails, `results: []` + `legal_context` populated — no 503.

**Rollback:** revert PR #12 (no feature flag by decision).

**Seeding the table:** Joyjit runs `python ingest/load.py` locally with env `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`. Batch 200 upserts on `id` — idempotent. Expected row count: 7,438. Until seeded, all hybrid paths fall back to live Perplexity gracefully.

---

## ABS Wizard (`/app/abs`)

- **Pure logic:** `frontend/lib/abs_logic.ts` — 5-question matrix, `nextQuestion()` branching (Q1=No skips Q2/Q3/Q4), `deriveObligations()`, `buildResult()`, `buildAskQuery()`, `buildEscalateSummary()`.
- **UI:** `frontend/app/app/abs/page.tsx` — `useReducer` state machine (`loading|start|question|result`), progress bar, live counter with `gooeyIn` tick-up, confetti on completion, actions: Save / Download PDF / Escalate / Ask about this / Retake.
- **PDF export:** `frontend/components/ABSMemoPDF.tsx` — lazy-loaded jsPDF (`@4.2.1`), A4 black-on-white memo.
- **Persistence:** save is opt-in. On revisit, latest saved diagnosis loads directly into the memo screen; Retake starts a fresh run. Always rebuild `AbsResult` from stored `answers` (never trust stored `obligations`) so logic updates propagate.
- **Deep-links:** memo → `/app/ask?q=<question>` auto-sends; memo → `/app/escalate?summary=<text>&issueType=ABS+clearance+guidance` pre-fills.
- **Cost:** zero API calls. Runs even if Edge Functions are down.
