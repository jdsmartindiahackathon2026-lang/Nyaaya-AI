# Context — Nyaaya AI / IP-SAKTI

_Last updated: Session 3 — 2026-09-03_

---

## Current state

The frontend is visually complete and matches the Claude Design mockup. All 6 Edge Functions are deployed. Next session focuses on backend wiring: API keys, rate limiting, E2E smoke test, and Vercel deploy.

| Layer | Status |
|---|---|
| Frontend (Next.js 14) | ✅ Complete — 3-column shell, all pages, opening splash, tree/leaves |
| Edge Functions | ✅ All 6 ACTIVE on Supabase `nrsfljvrtsnewkbufdid` |
| DB Schema | ✅ Applied — 4 tables with RLS |
| API Keys (Perplexity, Groq) | ❌ Not yet set in Supabase Secrets |
| Rate limiting | ❌ Not implemented — security gap |
| Vercel deployment | ❌ Not configured |

---

## Edge Functions (all deployed — ACTIVE)

| Function | File | Calls |
|---|---|---|
| `ask-query` | `supabase/functions/ask-query/index.ts` | Perplexity Sonar API |
| `classify-formulation` | `supabase/functions/classify-formulation/index.ts` | Perplexity Sonar API |
| `tkdl-search` | `supabase/functions/tkdl-search/index.ts` | Perplexity Sonar API |
| `mini-guide` | `supabase/functions/mini-guide/index.ts` | Groq Llama 3.3-70b |
| `translate` | `supabase/functions/translate/index.ts` | Google Translate API |
| `escalate` | `supabase/functions/escalate/index.ts` | Supabase DB write only |

Deploy command:
```
supabase functions deploy ask-query classify-formulation tkdl-search mini-guide translate escalate --project-ref nrsfljvrtsnewkbufdid
```

---

## Secrets status

| Secret | Status |
|---|---|
| `PERPLEXITY_API_KEY` | Confirm in Supabase dashboard before deploy |
| `GROQ_API_KEY` | Confirm in Supabase dashboard before deploy |
| `GOOGLE_TRANSLATE_API_KEY` | ✅ Added (Session 3) |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-available in Edge Functions (no manual step) |

---

## Open decisions

- **Rate limiting:** Not implemented on any Edge Function. Must be added before public/demo exposure. Approach TBD — simple in-function counter vs. Supabase pg_cron vs. external (Upstash Redis).
- **Landing page:** `frontend/landing-page.html` is a separate static HTML for the hackathon submission page — not part of the Next.js app.
- **ABS Helper:** Static decision tree (not live query). Users needing cited answers are redirected to Ask.

---

## Frontend env vars needed for Vercel

```
NEXT_PUBLIC_SUPABASE_URL=https://nrsfljvrtsnewkbufdid.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from Supabase dashboard>
```

---

## Supabase DB tables

- `users` — anonymous user profiles (language, jurisdiction, userType)
- `conversations` — session grouping
- `queries` — individual Q&A records
- `escalations` — human escalation requests

All tables have RLS enabled.
