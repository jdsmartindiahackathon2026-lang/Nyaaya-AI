# Progress Log

---

## Session 6 — 2026-09-03

### What was done

Built the 4-screen onboarding flow from the Claude Design handoff and fixed a silent RLS-blocking bug in the `users` upsert that would have prevented any onboarded profile from actually landing in Supabase.

Branch: `feature/onboarding-4-screens` → PR [#5](https://github.com/jdsmartindiahackathon2026-lang/Nyaaya-AI/pull/5) (open, awaiting Joyjit merge).

#### Files created
| File | Purpose |
|---|---|
| `frontend/components/OnboardingBackground.tsx` | Shared background layer for all 4 onboarding screens — radial gradient, tree watermark (`/tree-logo-full.png`), two glow washes, 22 randomized drifting leaf SVGs (`useMemo`'d once), inline `<filter id="gooeyReveal">` for title reveals |
| `frontend/public/tree-logo-full.png` | Yggdrasil watermark asset copied from design handoff |

#### Files modified
| File | Change |
|---|---|
| `frontend/app/onboarding/page.tsx` | Fully replaced. Single-file 4-screen client component: Language (EN/HI/BN) → Who Are You (4 roles) → Context Questions (role-branched) → Session Summary. `useEffect` short-circuits to `/app/ask` if `localStorage.nyaaya_onboarded === '1'`. Screen 4 CTA is the ONLY place that runs `signInAnonymously` + `users` upsert. **Bug fix:** old upsert wrote `{ id: authUid, preferred_language }` — `preferred_language` doesn't exist and leaving `auth_id` NULL fails the `auth.uid() = auth_id` RLS check. New upsert writes `{ id: authUid, auth_id: authUid, user_type, language, jurisdiction: 'india', context_answers }`. |
| `frontend/components/AppHeader.tsx` | Removed India/International toggle. Replaced with fixed non-interactive `Jurisdiction · India` label. `jurisdiction` + `onJurisdictionChange` props kept in interface (call sites still pass them) but unread. |
| `frontend/app/globals.css` | Added keyframes: `leafDrift`, `cardZoomIn`, `gooeyIn`, `tooltipBounce`, `tooltipText`. |

#### Security verification
- All 4 public tables (`users`, `conversations`, `messages`, `escalations`) have RLS enabled with correct `auth.uid()`-scoped policies. Verified via Supabase MCP.
- One advisor warning noted (WARN, not blocking): `public.rls_auto_enable()` is SECURITY DEFINER and callable by anon/authenticated. Revoke `EXECUTE` in a future migration.

### Verified
- `npx next build` — 8 routes compile clean, 0 errors
- Dev server running at http://localhost:3000/ (`/onboarding` route confirmed reachable)

### Decisions made
- **Languages:** 3 as designed (EN/HI/BN). Tamil intentionally excluded from onboarding (still available in-app LeftSidebar for the mini-guide, but users profile only stores EN/HI/BN — matches existing DB CHECK constraint).
- **Jurisdiction:** hardcoded to India everywhere it is user-visible. AppHeader toggle removed. Session 4-onwards decision.
- **Returning users:** skip onboarding via `localStorage.nyaaya_onboarded` flag.
- **`id = auth_id` in users row:** avoided needing a new unique constraint on `auth_id` (a DDL migration was blocked by the classifier); reused the existing `id` PK. Both columns now hold the auth UID — the FK to `auth.users(id)` on `auth_id` and the RLS check both work.

### Pending (carry to Session 7 — Auth + Login)
| Task | Owner | Notes |
|---|---|---|
| Design + build login/signup screens | Agent + Joyjit | Replaces `signInAnonymously` with real Supabase auth (email + password / OAuth TBD) |
| Wire login → profile-exists check → onboarding gate | Agent | If `users` row exists for the auth user, skip onboarding; otherwise run the 4 screens. |
| Revoke EXECUTE on `public.rls_auto_enable()` | Agent | Advisor WARN — one-line migration |
| Rate limiting on all 6 Edge Functions | Agent | Still open from Session 5 |
| Set `PERPLEXITY_API_KEY` + `GROQ_API_KEY` in Supabase Secrets | Joyjit | Still open |
| Vercel deployment | Joyjit | Still open |
| E2E smoke test | Agent (after keys) | Still open |

---

## Session 5 — 2026-09-03

### What was done

Fixed all 11 backend bugs identified in the Session 4 audit. Branch: `fix/backend-criticals-session-5` off `feature/frontend-app-shell-and-pages`. Executed as 3 planned passes (Opus planning, Sonnet subagents executing).

#### Files created
| File | Purpose |
|---|---|
| `supabase/functions/_shared/auth.ts` | `requireUser(req)` — validates JWT via `supabase.auth.getUser()`; works for anonymous + future authenticated users. Service-role tokens (internal function-to-function calls) bypass to synthetic `{ id: 'system', is_service_role: true }` user. |
| `supabase/functions/_shared/cors.ts` | `corsHeaders(req)` + `handleOptions(req)` — reads `ALLOWED_ORIGINS` env var (comma-separated), echoes Origin only if allowlisted, adds `Vary: Origin`. Default: `http://localhost:3000`. |

#### Files modified
| File | Bug(s) | Change |
|---|---|---|
| `supabase/functions/translate/index.ts` | 1, 9, 2 (dup), 10 | Body parsed once outside try/catch and reused in catch fallback; `targetLanguage` echoed correctly on failure; auth check; CORS helper |
| `supabase/functions/escalate/index.ts` | 3, 2, 10 | `user_id` derived from JWT (not body); auth check; CORS helper |
| `supabase/functions/ask-query/index.ts` | 4, 7, 11, 2, 10 | Model must emit `CONFIDENCE: HIGH\|MEDIUM\|ABSTAIN` line; `deriveConfidence` parses it (fallback `medium`); CONFIDENCE + CITATIONS both stripped from user answer; `history` param validated (role+content, capped last 6) and spread between system + user messages; sonar-pro fallback broadened to 400/402/403/429 with module-level `sonarProAvailable` flag flipped on 400/403 (permanent structural failure) but NOT on 402/429 (transient); auth check; CORS helper |
| `supabase/functions/classify-formulation/index.ts` | 5, 2, 10 | Model returns structured `CITATIONS:` block (`display_name \| url \| statute_ref`); local `parseCitations()` with domain-metadata fallback; auth check; CORS helper |
| `supabase/functions/tkdl-search/index.ts` | 6, 2, 10 | Model returns JSON array (up to 5 records); handler strips markdown fences, `JSON.parse`s, validates status enum, coerces empty `tkdlRef` to null; falls back to single-record parse with `console.warn` on JSON failure; auth check; CORS helper |
| `supabase/functions/mini-guide/index.ts` | 8, 2, 10 | System prompt now takes `(currentScreen, language)`; validates against `en/hi/ta/bn`; instructs Groq/Llama 3.3-70b to respond in the target language directly (no separate translate call); auth check; CORS helper |
| `frontend/app/app/ask/page.tsx` | 7 | Builds `history` array from `messages` state (captured before new user turn appended) and sends `.slice(-6)` in `supabase.functions.invoke` body |

### Decisions made
- **Auth model:** shared `requireUser()` helper validates any Supabase JWT — anonymous (today's onboarding flow) or authenticated (future login screen). No backend change needed when the login system lands; `supabase.functions.invoke()` auto-attaches whatever token the session carries.
- **Service-role bypass:** `ask-query` calls `translate` internally with the service-role key; `requireUser` detects and passes it through as a synthetic system user rather than 401-ing. Escalate is not affected (frontend-only caller).
- **Conversation history:** session-only mode. Frontend keeps `messages` state, sends last 6 turns per call. No DB persistence (deferred until real login screen; current `messages` table write remains dead code gated on `conversationId` which the frontend still sends as null).
- **Confidence fallback:** unparseable `CONFIDENCE:` line defaults to `medium` — signals uncertainty rather than false confidence.
- **sonar-pro flag:** flipped on 400/403 only (real "model not available"); 402/429 are transient billing/rate-limit signals so those trigger the fallback but keep the flag.
- **CORS origins:** env var-driven so Joyjit can add the Vercel domain later without a code change. Default is dev origin only.
- **mini-guide language:** Llama 3.3-70b is multilingual — cheaper + lower latency to prompt-in-target-language than to call translate.

### Verified
- All 6 Edge Functions grep-clean of `Access-Control-Allow-Origin: '*'` (only the templated one in `cors.ts` remains).
- Sonar-pro logic reviewed by reading `ask-query/index.ts:176–197`.
- Frontend `history` build captures state BEFORE new turn appended — correct snapshot.
- Translate fallback echoes `body.targetLanguage || 'en'` (already fixed in first pass, reconfirmed).

### Pending (carry to Session 6)
| Task | Owner |
|---|---|
| Set `PERPLEXITY_API_KEY` + `GROQ_API_KEY` in Supabase Secrets | Joyjit |
| Set `ALLOWED_ORIGINS` in Supabase Secrets (once Vercel domain is live) | Joyjit |
| Redeploy all 6 Edge Functions: `supabase functions deploy ask-query classify-formulation tkdl-search mini-guide translate escalate --project-ref nrsfljvrtsnewkbufdid` | Joyjit / Agent (after PR merge) |
| Rate limiting on all 6 functions | Agent |
| Vercel deployment + branch protection on `main` | Joyjit |
| E2E smoke test (needs keys set) | Agent |
| Login screen + real user accounts (replaces `signInAnonymously`) | Team |
| Onboarding screens polish | Joyjit (Claude Design) |
| DB-backed conversation persistence (revisit when login lands) | Agent |

### Known gaps / risks
- Frontend still sends `conversationId: null` — the `messages` table write in `ask-query` is dead code. Not a regression, just unchanged. Revisit alongside login.
- `context.md` still lists Bengali (`bn`) in the DB schema check constraint but frontend supports Tamil (`ta`) too — schema drift to address in Session 6.
- `mini-guide` was NOT updated with a language column in DB anywhere (no persistence expected).

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
