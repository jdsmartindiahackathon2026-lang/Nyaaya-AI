# Progress Log

---

## Session 3 — 2026-09-02 → 2026-09-03

### What was done

Polished the frontend app shell UI to match the Claude Design mockup exactly. All visual work is on branch `feature/frontend-app-shell-and-pages`.

#### UI changes

| File | Change |
|---|---|
| `frontend/app/app/layout.tsx` | Rewrote to use `position: absolute` sidebars (SIDEBAR_W = 310) for reliable 3-column layout on all viewports; added Yggdrasil tree background scoped to center panel; wired OpeningSplash with splashDone state |
| `frontend/app/globals.css` | Added `height: 100%` to html/body to prevent grid row collapse |
| `frontend/components/LeftSidebar.tsx` | Always expanded; 4 languages (EN/HI/TA/BN); 5 nav items; Corpus Roots card |
| `frontend/components/RightSidebar.tsx` | Always expanded; Nine Realms map; Session block; Guardrails |
| `frontend/components/AppHeader.tsx` | Jurisdiction toggle: India / International only (removed merged pill) |
| `frontend/components/ParticleField.tsx` | 24 glowing particles (doubled) + 18 falling emerald leaves with `@keyframes leafFall` sway animation |
| `frontend/components/OpeningSplash.tsx` | Opening video splash — autoplay, fade-out on end, skip button, bottom gradient overlay to cover Gemini watermark |
| `frontend/app/app/ask/page.tsx` | Removed local tree background (now in layout) |
| `frontend/public/yggdrasil-tree.png` | Added (copied from project root) |
| `frontend/public/opening.mp4` | Added/replaced with user's revised video |

#### Supabase Edge Functions
All 6 deployed and ACTIVE via Supabase MCP during this session:
`ask-query`, `classify-formulation`, `tkdl-search`, `mini-guide`, `translate`, `escalate`

#### Context
- `context.md` created (was missing per CLAUDE.md instructions)

### Verified
- 3-column shell renders correctly in browser at localhost:3000
- Yggdrasil tree positioned at `objectPosition: center 38%` — matches Claude Design mockup (LOCKED, never change)
- Falling leaves + doubled particles render without layout impact
- Opening video splash plays on load, fades out on end, skip button works
- Bottom gradient overlay on splash covers Gemini watermark

### Decisions made
- Tree `objectPosition: 'center 38%'` locked permanently — user approved and flagged "never change"
- Tree scoped to center panel only (not full viewport) to preserve correct crop at this aspect ratio
- Opening video: `objectFit: contain` + 30% bottom gradient (transparent → #070d0b at 60%) to hide Gemini sparkle icon
- Sidebar width set to 310px (wider than default) to match Claude Design proportions

### Pending (carry to Session 4 — backend focus)

| Task | Owner | Notes |
|---|---|---|
| Add PERPLEXITY_API_KEY to Supabase Secrets | Joyjit | Required before ask-query / classify-formulation / tkdl-search can return real answers |
| Add GROQ_API_KEY to Supabase Secrets | Joyjit | Required for mini-guide Edge Function |
| Rate limiting on all 6 Edge Functions | Agent | Security gap — must be added before demo day |
| Configure Vercel deployment | Joyjit | Connect `frontend/` dir, add `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Enable branch protection on `main` | Joyjit | GitHub → Settings → Branches |
| E2E smoke test | Agent | Onboarding → ask question → Edge Function response (needs Perplexity key first) |
| Onboarding screens | Agent | User building in Claude Design — will send designs for implementation |

### Known gaps / risks
- **Perplexity + Groq keys absent** — Edge Functions will fail until keys are set in Supabase Secrets
- **Rate limiting absent** on all 6 Edge Functions — must add before public/demo exposure
- **Vercel not connected** — app runs locally only

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
