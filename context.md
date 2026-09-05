# Context — Nyaaya AI / IP-SAKTI

_Last updated: Session 12 close — 2026-09-06_

---

## Current state

**LIVE at [https://nyaaya-ai-six.vercel.app](https://nyaaya-ai-six.vercel.app).** Deploy day happened in Session 12. Full stack shipped end-to-end: landing → login → onboarding → app (Ask, Classify, TKDL, ABS, Escalate) + Profile screen. Perplexity dependency fully removed — all knowledge Edge Functions call Anthropic Claude Haiku 4.5 with the native `web_search_20250305` server tool, restricted to the approved-sources domain whitelist. Hybrid RAG local-first path preserved: `embed-query` → `match_statute_chunks` pgvector RPC → grounded synthesis with `#page=` deep-link citations; web fallback only when local cosine < threshold.

| Layer | Status |
|---|---|
| Vercel deploy | ✅ Live at nyaaya-ai-six.vercel.app (Next 14, frontend/ root) |
| Landing page (`/`) | ✅ Shipped PR #15 — Yggdrasil hero, 5-card capabilities, 19-act corpus, mocked demo, single-line footer credit |
| Profile screen (`/app/profile`) | ✅ Shipped PR #14 — 13 tabs, identity/preferences persist to users.preferences JSONB, avatar upload to `avatars` bucket, delete-account + export-user-data Edge Functions live |
| ConfirmDialog component | ✅ Built PR #20 (OPEN at wrap) — Yggdrasil-palette modal, replaces browser window.confirm |
| Hybrid RAG runtime | ✅ Live — 7,438 chunks across 19 sources in `statute_chunks`, HNSW cosine index, match RPC scoped by RLS |
| **Anthropic Claude Haiku 4.5** | ✅ Replaces Perplexity in ask-query v10, classify-formulation v8, tkdl-search v8. `web_search_20250305` tool with `allowed_domains` filter. |
| Frontend (Next.js 14) | ✅ Complete — 3-column shell, all pages, 4-screen onboarding, splash removed, react-markdown v9 rendering, designed AnswerCard |
| Auth (email/pw + Google OAuth) | ✅ End-to-end tested on production Vercel domain |
| Onboarding profile writes | ✅ Writes RLS-safe user row |
| RLS isolation | ✅ Verified — all public tables enforce `auth.uid()`-scoped policies; activity_events_v uses `security_invoker=true` |
| Rate limiting | ✅ Live — 20/min ask+classify+tkdl, 30 mini-guide, 60 translate+embed, 5 escalate. `check_rate_limit` RPC is SECURITY DEFINER; `rate_limits` table has deny-all RLS |
| Edge Function CORS | ✅ Fixed Session 12 — `x-client-info` + `apikey` added to Allow-Headers on all 8 MCP-deployed functions |
| Citation URL trust | ✅ All 3 retrieval Edge Fns filter citation URLs against real `web_search_tool_result` set (kills Claude hallucinations) |
| `ANTHROPIC_API_KEY` | ✅ Set. **Expires 2026-10-05 — rotate before then.** |
| `GROQ_API_KEY` | ✅ Set (mini-guide) |
| `GOOGLE_TRANSLATE_API_KEY` | ✅ Set (translate) |
| `ALLOWED_ORIGINS` | ✅ `http://localhost:3000,https://nyaaya-ai-six.vercel.app` |
| `PERPLEXITY_API_KEY` | ⚪ Secret still in Supabase but no code references it — can be deleted |
| `escalate` / `mini-guide` / `translate` | ⚠️ Still on old CLI-deployed versions with old CORS headers — need inline+redeploy (or CLI deploy). Not blocking demo. |
| `rls_auto_enable()` SECURITY DEFINER | ⚠️ Advisor WARN — revoke EXECUTE in a future migration |

---

## Edge Functions (deployed state)

| Function | Version | Model | Notes |
|---|---|---|---|
| ask-query | v10 | claude-haiku-4-5 + web_search_20250305 | Hybrid RAG local-first, jurisdiction-scoped domain filter, /gim CONFIDENCE strip, trustedUrl citations |
| classify-formulation | v8 | claude-haiku-4-5 + web_search_20250305 | Deterministic classify → RAG citations or web fallback with trustedUrl filter |
| tkdl-search | v8 | claude-haiku-4-5 + web_search_20250305 | Promise.all(RAG framing, web TKDL records); records[].source filtered to real web URLs |
| embed-query | v4 | bge-small-en-v1.5 (Transformers.js in Deno) | 384-dim, cosine, quantized, cold start 5-15s |
| delete-account | v4 | — | POST, JWT, deletes users row + auth user (cascade) |
| export-user-data | v4 | — | POST, JWT, returns full user data JSON dump (RLS-scoped) |
| title-conversation | v4 | llama-3.3-70b via Groq | 3-6 word thread titles, Title Case |
| escalate | v2 (CLI, old CORS) | — | Frontend calls direct; needs CLI redeploy with CORS fix |
| mini-guide | v2 (CLI, old CORS) | llama-3.3-70b via Groq | Multilingual, screen-aware, needs CLI redeploy with CORS fix |
| translate | v2 (CLI, old CORS) | Google Translate API | Called internally by ask-query for non-EN answers |

---

## Frontend routes

| Route | Purpose |
|---|---|
| `/` | Public landing page (Session 12 shipped) |
| `/login` | Email/pw + Google OAuth |
| `/auth/callback` | OAuth + password-reset return handler |
| `/onboarding` | 4-screen flow (language → user type → context → summary) |
| `/app/ask` | Grounded Q&A with designed AnswerCard, markdown, real citations, conversation history rail |
| `/app/classify` | 3-step formulation wizard |
| `/app/tkdl` | TKDL prior-art search |
| `/app/abs` | ABS Compliance Wizard (SHIPPED Session 8) |
| `/app/escalate` | Human hand-off form |
| `/app/profile` | 13-tab profile & settings (SHIPPED Session 12) |

---

## Repo hygiene

- CLAUDE.md ground rules stand
- **PR merge race lesson learned Session 12** — Joyjit merges fast; commits pushed after merge get stranded. Open PRs AFTER pushing every commit. See `feedback_pr_merge_race.md` in memory.
- Branch protection on `main`: NOT enabled. Would prevent stranded-commit issue if turned on with "require branches up to date."

---

## Next session (13) focus

**Groq Mini Guide bot deep dive.** The floating chat widget bottom-right of `/app/*`. Uses `mini-guide` Edge Function (Llama 3.3-70b via Groq). Areas to explore:
- Prompt tuning for screen-context awareness (`currentScreen` param already passed)
- Multi-turn context (currently stateless)
- UX polish (open/close animation, transcript persistence)
- Rate-limit review
- Whether to migrate to Claude Haiku or keep Groq
- Inline `_shared/cors.ts` and MCP-redeploy with the CORS fix (currently on old CLI version)
