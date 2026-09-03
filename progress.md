# Progress Log

---

## Session 8 — 2026-09-04

### What was done

Built and shipped the ABS Compliance Wizard end-to-end. PR [#9](https://github.com/jdsmartindiahackathon2026-lang/Nyaaya-AI/pull/9) merged to `main` (merge commit `c9392fd`). Execution plan: Opus 4.7 planned and coordinated; three Sonnet 4.6 subagents executed Tracks A/B/D in parallel, Track C followed once Track B landed.

#### Files created
| File | Purpose |
|---|---|
| `supabase/migrations/20260904000000_abs_diagnoses.sql` | New `public.abs_diagnoses` table — `{id, user_id FK→users.id, answers JSONB, obligations JSONB, obligation_count INT, created_at}` with user-scoped RLS matching the escalations pattern. Applied to remote via Supabase MCP. |
| `frontend/lib/abs_logic.ts` | Pure logic module — 246 lines, zero React. Exports: `AbsAnswers` / `Question` / `Obligation` / `AbsResult` types, `QUESTIONS` constant, `nextQuestion`, `skippedQuestions`, `deriveObligations`, `buildResult`, `buildAskQuery`, `buildEscalateSummary`. |
| `frontend/components/ABSMemoPDF.tsx` | jsPDF-based memo generator (~103 lines). Lazy-loaded — only imported when user clicks Download. Renders title/date/headline/intro/checklist/disclaimer in A4 with black-on-white. |

#### Files modified
| File | Change |
|---|---|
| `frontend/app/app/abs/page.tsx` | Full rewrite (~648 lines). `useReducer` state machine with `loading / start / question / result` modes. On mount, fetches latest `abs_diagnoses` row for the user — if present, jumps to memo. Progress bar, answered-row summary stack, `slideInRight` question card, floating live obligation counter with `gooeyIn` on tick-up + threshold colour shifts (grey→amber→accent), confetti burst on completion. Actions: Save (inserts new diagnosis row), Download PDF, Escalate (deep-links with `?summary=` + `?issueType=`), "Ask about this" per obligation (deep-links with `?q=`), Retake. Reference-view accordion preserved at bottom. |
| `frontend/app/app/ask/page.tsx` | Wrapped in `<Suspense>` + reads `?q=<url-encoded>` on mount; auto-populates textarea, calls `sendQuery`, clears param via `router.replace`. `autoSentRef` guard prevents re-fire. |
| `frontend/app/app/escalate/page.tsx` | Wrapped in `<Suspense>` + reads `?summary=` and `?issueType=` on mount. Populates `description` state and (when matching an existing option) `issueType` state. Clears params after hydration. |
| `frontend/app/globals.css` | Appended 2 keyframes: `slideInRight`, `confettiFall`. All other motion reuses existing `glowPulse` / `cardZoomIn` / `gooeyIn` / `riseIn` / `leafDrift`. |
| `frontend/package.json` + `package-lock.json` | Added `jspdf@4.2.1`. |

### Decisions made

- **Persistence storage:** `public.abs_diagnoses` table (Option B from the pros/cons), NOT a JSONB column on `users`. Ayurveda practitioners will run the wizard once per formulation/client/export market — history matters. One row per run, `created_at DESC` on read gives the latest. Overwrites are impossible; retake = new row. Sets the pattern for future `classify_results` / `tkdl_searches` tables when we cache Perplexity calls.
- **Result reconstruction on revisit:** always rebuild `AbsResult` fresh via `buildResult(row.answers)` — never trust the stored `obligations` blob. Means logic-side updates (new statute anchors, added obligations) auto-propagate to old saved diagnoses.
- **Save is opt-in, not automatic.** User must click "Save to profile" — matches the "no data leaves your browser until you save" copy on the start screen. Honest and privacy-preserving.
- **Deep-link auto-send on Ask:** `?q=` doesn't just populate — it auto-sends and clears the param. Zero clicks between wizard obligation and answered question.
- **Deferred:** Q1=No path visual — spec called for greyed-out skipped questions collapsing into a single "3 questions skipped" pill. Implemented as a summary row per `skippedQuestions()` — same information, simpler UI.

### Verified

- `next build` clean — 12 routes, 0 errors, `/app/abs` = 6.9 kB.
- Migration `abs_diagnoses_table` applied via Supabase MCP; `list_tables` confirms RLS on. No new advisor warnings.
- Local browser test: Joyjit ran full wizard, hit "Ask about this" on a memo obligation, navigated to `/app/ask?q=...` with question pre-filled and auto-sent. First attempt hit stale Next dev-cache after adding jspdf (`webpack-runtime.js: Cannot read properties of undefined (reading 'call')`) — fixed by `Remove-Item -Recurse -Force .next` + restart on port 3001.

### Delivery process notes

- **Multi-agent orchestration worked well.** Opus planning + parallel Sonnet execution shipped the whole feature in one session including a live bugfix cycle. Track split (A: DB, B: logic, C: UI, D: cross-page) had exactly one true dependency (C→B); everything else parallel-safe.
- **Track C subagent committed itself** (`6838fd6`) without waiting for the coordinator. Committed the UI while abs_logic.ts (imported dependency) was still untracked. Not broken in the final tree because subsequent commits closed the gap and we squash-merge PRs, but noting: subagent commit discipline is worth explicit prompting next time.
- **Windows PowerShell footguns hit twice.** `&&` isn't valid in PS 5.1 (use `;`), and `npm.ps1` is execution-policy-blocked (use `npm.cmd`). Baked into Joyjit's environment — worth remembering for future dev-server restart instructions.

### Pending (carry to Session 9)

| Task | Owner |
|---|---|
| Set `PERPLEXITY_API_KEY` in Supabase Secrets | Joyjit — still blocking Ask/TKDL/Classify-citations |
| Vercel deploy + `NEXT_PUBLIC_*` env vars + branch protection on `main` | Joyjit |
| After Vercel live: add domain to `ALLOWED_ORIGINS`, Google OAuth redirect URIs, Supabase Site URL | Joyjit |
| E2E smoke test (Browser pane, once Perplexity key set) | Agent |
| Hybrid RAG plan execution (10 core acts + pgvector) | Agent |
| Conversation persistence (revive dead `messages` insert + New Chat UI) | Agent |
| Small polish: tree logo above `/login` heading | Agent (chip spawned earlier) |
| Kill the zombie dev server on port 3000 (currently displaced to 3001) | Joyjit — cosmetic |

### Known gaps / risks

- Same as Session 7 close: Perplexity key + Vercel are the only demo blockers.
- ABS Wizard obligation counter's amber colour is inline `rgba(217,180,127,0.9)` rather than a new CSS var — if theme evolves, move to `--warn`.

---

## Session 7 — 2026-09-03

### What was done

Full login + auth wiring landed on branch `feature/login-and-auth-wiring` — PR #7, open, awaiting merge. Google OAuth confirmed working end-to-end after Joyjit enabled the provider in Supabase dashboard.

#### Files created
| File | Purpose |
|---|---|
| `frontend/app/login/page.tsx` | 1:1 port of Claude Design login (from `Landing Page of IP-SAKTI.zip`). Yggdrasil bg with mouse-parallax breathing/glow, fireflies, butterflies, drifting leaves, rising particles, streaks, vignette. Email/password sign-in + sign-up (strength meter, terms), Google OAuth, Forgot-password → `resetPasswordForEmail`, inline validation, banner. Wrapped in `Suspense` for `useSearchParams`. |
| `frontend/app/auth/callback/page.tsx` | OAuth + password-reset return handler. Hydrates session from URL, routes based on whether `public.users` row exists for `auth.uid()`. Also `Suspense`-wrapped. |
| `frontend/public/yggdrasil-bg.png` | Background asset for login (from Claude Design handoff). |

#### Files modified
| File | Change |
|---|---|
| `frontend/app/page.tsx` | Was static `redirect('/onboarding')`. Now session-aware router — no session → `/login`, session + profile row → `/app/ask`, session + no profile → `/onboarding`. |
| `frontend/app/app/layout.tsx` | Added auth gate — checks Supabase session on mount, redirects to `/login` if absent; `onAuthStateChange` listener bounces on sign-out. Renders "Loading…" until session check completes. |
| `frontend/app/onboarding/page.tsx` | No longer calls `signInAnonymously()`. Requires an existing session (bounces to `/login` if missing). Upserts `public.users` against the real JWT's `auth.uid()`. Also gates on existing profile row — skips straight to `/app/ask` if user already onboarded. |
| `frontend/components/RightSidebar.tsx` | Added "Account" card with **Sign out** button. Calls `supabase.auth.signOut()`, clears `nyaaya_*` localStorage, routes to `/login`. |

### Decisions made
- **Auth handoff:** `/login` handles OAuth + password + reset in one page (mode toggle). No separate `/signup` or `/forgot-password` routes — kept the design's single-card intent.
- **Google Client ID/Secret pasted by Joyjit only.** Rule stands: assistant never enters credentials into any form (Supabase dashboard, Google Cloud, anywhere). Even locally, even with explicit permission.
- **`useSearchParams` Suspense boundaries** added on `/login` and `/auth/callback` — Next 14 App Router requires this for the static build. Wrapper components (`LoginPageWrapper`, `AuthCallbackWrapper`) do this.
- **Password handling:** frontend never touches raw passwords beyond passing them to `supabase.auth.signUp` / `signInWithPassword`. Bcrypt hashing + storage handled entirely by Supabase's `auth.users.encrypted_password`. `public.users` has no password field. Confirmed compliant with CLAUDE.md rule #3.
- **Vignette + gradient tuning:** design's fixed-pixel overlays (200px vignette, 0.55 top gradient) were tuned at 900px canvas and looked washed out at desktop viewports. Bumped to `inset 0 0 400px 120px rgba(0,0,0,0.75)` + `0.7/0.45/0.85` stops for readable dimming at any width. Committed as a follow-up patch.

### Verified
- `next build` clean — 12 routes, 0 errors.
- `/login` renders 1:1 with design (bg parallax, fireflies, butterflies, card, mode toggle).
- Signup mode swaps heading, adds Full name + Confirm password + Terms checkbox, CTA changes.
- After Joyjit enabled Google provider in Supabase dashboard, OAuth flow tested end-to-end successfully.
- Password hashing confirmed: `public.users` schema has no password column; `auth.users.encrypted_password` (bcrypt, len 60) holds it — never leaves Supabase.

### LOC snapshot (Session 7 close)
| Layer | Lines |
|---|---|
| Backend (Edge Functions, `_shared` helpers, JSON configs) | 957 |
| Frontend (Next.js app + components + lib) | 3,222 |
| DB migrations | 62 |
| Docs (top-level `*.md`) | 2,175 |
| **Total (code + docs)** | **6,416** |

### Session 7 close (2026-09-04)

Continued on 2026-09-04 (calendar day rolled during the session). Landed:
- PR #7 (login + auth) merged.
- PR #8 (rate limiting + schema drift + advisor fix) opened and merged.
- Migrations applied to remote: `users_language_allow_tamil`, `revoke_execute_rls_auto_enable`, `rate_limits_table_and_rpc`.
- All 6 Edge Functions redeployed to v2 ACTIVE via Supabase MCP (CLI wasn't logged in; deployed each function with inlined shared files).
- Supabase Auth policy tightened by Joyjit: min password length 8, char-class rule (lower+upper+digit+symbol), Secure email change on. HIBP leaked-pw deferred (Pro-plan gated).
- Google OAuth verified end-to-end after Joyjit enabled the provider.
- `GROQ_API_KEY` confirmed set. `PERPLEXITY_API_KEY` still pending.
- ABS Wizard design PDF delivered (`scratchpad/ABS_Wizard_Design.pdf`) — awaiting go-ahead to build. Memory entry `project_abs_wizard.md` created.
- Full screen-by-screen technical report PDF delivered to Joyjit (`scratchpad/Nyaaya_AI_Screen_Report.pdf`) for the SIH internal round presenters — 13 pages, covers every screen + judge FAQ + caveats + roadmap.

### Pending (carry to Session 8)
| Task | Owner |
|---|---|
| Set `PERPLEXITY_API_KEY` in Supabase Secrets | Joyjit — unblocks Ask, TKDL, Classify-citations |
| Vercel deploy + `NEXT_PUBLIC_*` env vars + branch protection on `main` | Joyjit |
| After Vercel live: add domain to `ALLOWED_ORIGINS`, Google OAuth redirect URIs, Supabase Site URL | Joyjit |
| E2E smoke test (Browser pane, once Perplexity key set) | Agent |
| ABS Wizard build (design PDF ready) | Agent — pending user go-ahead |
| Hybrid RAG plan execution (10 core acts + pgvector) | Agent |
| Conversation persistence (revive dead `messages` insert + New Chat UI) | Agent |
| Small polish: add tree logo above `/login` heading | Agent (chip spawned) |
| Optional: commit or discard uncommitted `/login` vignette defensive fix in working tree | Agent — currently discarded |

### Known gaps / risks
- Rate limiting still absent on all 6 Edge Functions — must land before public exposure.
- Frontend still sends `conversationId: null`; `messages` insert in `ask-query` remains dead code. Now unblocked (real users exist), but not required for hackathon demo.
- Schema drift: `users.language` CHECK still `('en','hi','bn')`; frontend offers Tamil. Migration deferred to next session.

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
