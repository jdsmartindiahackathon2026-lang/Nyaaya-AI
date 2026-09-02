# Progress Log

---

## Session 2 — 2026-09-02

### What was done

Built the complete Next.js frontend from the Claude Design template. All pages compile cleanly (verified with `npx next build` — 10 routes, 0 errors).

#### Files created / updated

| File | Description |
|---|---|
| `frontend/app/layout.tsx` | Root layout — fonts via `next/font/google` (IBM Plex Sans, IBM Plex Mono, Source Serif 4) |
| `frontend/app/page.tsx` | Root redirect → `/onboarding` |
| `frontend/app/globals.css` | Removed `@import` Google Fonts (now via next/font), added `--font-serif/mono` CSS var fallbacks |
| `frontend/app/app/layout.tsx` | 3-panel app shell: LeftSidebar + main (AppHeader + children) + RightSidebar + ParticleField + MiniGuide; reads/writes `nyaaya_language`, `nyaaya_jurisdiction`, `nyaaya_userType` from localStorage |
| `frontend/app/app/ask/page.tsx` | Full Ask interface — empty state with 4 suggestion cards, conversation thread, confidence badge, source citation pills, disclaimer footer, Enter to send |
| `frontend/app/app/classify/page.tsx` | 3-step Classify Formulation wizard → `classify-formulation` Edge Function; shows classification, regime, rationale, next steps, citations |
| `frontend/app/app/tkdl/page.tsx` | TKDL Prior Art search → `tkdl-search` Edge Function; status badge (documented / partial / not_found) with colour coding |
| `frontend/app/app/abs/page.tsx` | ABS Helper — static decision tree (5 key questions) + official reference links (BD Act, NBA guidelines, Nagoya Protocol) |
| `frontend/app/app/escalate/page.tsx` | Escalate to Human form → `escalate` Edge Function; success state with facilitator SLA note |
| `frontend/app/onboarding/page.tsx` | 3-screen onboarding (user type → language → jurisdiction) → `supabase.auth.signInAnonymously()` → `users` table upsert → `/app/ask` |

#### Components written in Session 1 (unchanged)
`ParticleField`, `IPSaktiLogo`, `LeftSidebar`, `RightSidebar`, `AppHeader`, `MiniGuide`

### Verified
- `npx next build` passes cleanly — all 10 routes compile, no TypeScript errors
- All Edge Function calls use `supabase.functions.invoke()` with correct function names matching Session 1 Edge Functions
- localStorage keys consistent across all pages: `nyaaya_language`, `nyaaya_jurisdiction`, `nyaaya_userType`
- Onboarding → anonymous auth → users table write path implemented

### Decisions made
- ABS Helper is static (decision tree) rather than a live query — ABS questions are structural, not corpus-retrieval. Users who need cited answers are redirected to Ask.
- Root `/` redirects to `/onboarding` — no landing page route in the app shell (landing page is a separate static HTML for the hackathon submission)

### Pending (carry to Session 3)

| Task | Owner | Notes |
|---|---|---|
| Deploy all 6 Edge Functions | Joyjit | `supabase functions deploy ask-query classify-formulation tkdl-search mini-guide translate escalate` |
| Add `GOOGLE_TRANSLATE_API_KEY` to Supabase Secrets | Joyjit | Via Supabase dashboard → Edge Functions → Secrets |
| Configure Vercel deployment | Joyjit | Connect `frontend/` dir, add `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars |
| Enable branch protection on `main` | Joyjit | GitHub repo → Settings → Branches |
| Rate limiting on Edge Functions | Agent | Known security gap from SECURITY_AUDIT_PLAYBOOK — add before demo day |
| End-to-end smoke test | Agent | Start dev server, go through onboarding → ask a question → verify response from Edge Function |
| `context.md` creation | Agent | CLAUDE.md says to create if missing — add current open decisions |

### Known gaps / risks
- **Rate limiting absent** on all 6 Edge Functions — flagged in SECURITY_AUDIT_PLAYBOOK. Must be added before public exposure.
- **Google Translate** key not yet set — translate Edge Function will fail silently; answers will return in English regardless of language setting until key is added.
- **Perplexity API key** — confirm it is set in Supabase Secrets before deploying ask-query.

---

## Session 1 — 2026-09-02

### What was done
- Scaffolded project structure (corrected from FastAPI → Supabase Edge Functions after reading TRD)
- Set up GitHub repo under `jdsmartindiahackathon2026-lang`
- Wrote all 6 Edge Functions: `ask-query`, `classify-formulation`, `tkdl-search`, `mini-guide`, `translate`, `escalate`
- Applied DB schema migration via Supabase MCP (4 tables: users, conversations, queries, escalations + RLS)
- Created CLAUDE.md, ENGINEERING_PRINCIPLES.md, SECURITY_AUDIT_PLAYBOOK.md, .gitignore
- Wrote 7 frontend components: globals.css, ParticleField, IPSaktiLogo, LeftSidebar, RightSidebar, AppHeader, MiniGuide
- Switched translation from Bhashini → Google Translate API

### Decisions made
- Stack confirmed: Next.js 14 + Supabase Edge Functions (Deno) — no Python/FastAPI
- Translation: Google Translate API (single POST, free tier, reliable for legal text)
- Auth: Supabase anonymous auth (`signInAnonymously`) — no passwords stored anywhere
