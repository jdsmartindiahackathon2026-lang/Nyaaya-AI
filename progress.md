# Progress Log

---

## Session 4 — 2026-09-03

### What was done

Set up the RAG source config and proper Perplexity API sourcing across all 3 Perplexity-calling Edge Functions.

#### Files changed

| File | Change |
|---|---|
| `supabase/functions/_shared/approved_sources.json` | Full rewrite — v2.0 schema with per-domain metadata (display name, category, trust tier, jurisdiction, covers), and named `filter_sets` for each Edge Function |
| `supabase/functions/ask-query/index.ts` | Jurisdiction-aware `search_domain_filter` (india/international/both pick different domain sets); upgraded to `sonar-pro` with `sonar` fallback on 402/429; structured citation block parsing (display name + url + statute_ref extracted); `temperature: 0.1`; `model_used` field in response; DB write made non-fatal |
| `supabase/functions/classify-formulation/index.ts` | Now uses `filter_sets.classify_formulation` instead of `all_domains` |
| `supabase/functions/tkdl-search/index.ts` | Now imports `approved_sources.json` and uses `filter_sets.tkdl_search` |

### Decisions made
- `sonar-pro` is the primary model for `ask-query` (better legal reasoning, longer context); falls back to `sonar` on quota/billing errors — no change in latency path for demos if key is standard tier
- Jurisdiction-aware domain filtering: India queries do not send international treaty domains to Perplexity (reduces noise); international queries don't send CDSCO/TKDL/FSSAI (irrelevant)
- Citation parsing: we instruct the model to produce a structured `CITATIONS:` block (display_name | url | statute_ref); if absent, fall back to raw URL list enriched with domain metadata. The block is stripped before the answer is sent to the user.
- `trips.wto.org` replaced with `wto.org` — Perplexity's domain filter requires the apex domain, not a subdomain

### Pending (carry to Session 5 — backend hardening)

#### API keys (Joyjit must do before any Edge Function works)
| Secret | Where |
|---|---|
| `PERPLEXITY_API_KEY` | Supabase dashboard → project `nrsfljvrtsnewkbufdid` → Edge Functions → Secrets |
| `GROQ_API_KEY` | Same |

#### Redeploy after this session's changes
```
supabase functions deploy ask-query classify-formulation tkdl-search --project-ref nrsfljvrtsnewkbufdid
```

#### Backend bugs to fix (Session 5)
| # | Issue | Severity | File |
|---|---|---|---|
| 1 | `translate` body-read bug — `req.clone()` after consumed stream silently drops translated answer | Critical | `translate/index.ts` |
| 2 | No auth check on any function — anyone on internet can call and burn Perplexity quota | Critical | all 6 functions |
| 3 | `escalate` trusts `userId` from request body — derive from JWT instead | Critical | `escalate/index.ts` |
| 4 | Confidence scoring keyword-scans answer text — "may" in statutes always returns medium; parse model's own HIGH/MEDIUM/ABSTAIN output instead | Serious | `ask-query/index.ts` |
| 5 | `classify-formulation` citations always have empty `statute_ref` | Serious | `classify-formulation/index.ts` |
| 6 | `tkdl-search` returns one prose blob, not parsed records | Serious | `tkdl-search/index.ts` |
| 7 | No conversation history sent to Perplexity — follow-up questions lose context | Serious | `ask-query/index.ts` |
| 8 | `mini-guide` ignores `language` field — always returns English | Minor | `mini-guide/index.ts` |
| 9 | `translate` fallback returns `targetLanguage: 'en'` even when request was for Hindi/Tamil/Bengali | Minor | `translate/index.ts` |
| 10 | CORS `*` on all functions — any site can call and drain quota | Minor | all 6 functions |
| 11 | `sonar-pro` may always fall back — confirm Joyjit's Perplexity key tier supports it | Minor | `ask-query/index.ts` |

#### Architecture note
The current system is **not a true RAG** — it is live retrieval via Perplexity Sonar with domain filtering. No vector store, no embeddings. Perplexity's crawler controls what is actually fetched. This is fine for the hackathon demo but should not be described to judges as "RAG." Correct framing: "live retrieval with approved-source filtering."

#### Other pending
| Task | Owner |
|---|---|
| Rate limiting on all 6 Edge Functions | Agent (Session 5) |
| Vercel deployment | Joyjit |
| E2E smoke test | Agent (after Perplexity key set) |
| Onboarding screens | Joyjit (Claude Design) |

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
