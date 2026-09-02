# Engineering Principles & Craft — Nyaaya AI

**Who this applies to:** any AI agent working on this project — Claude Code, Antigravity, Codex, or anything else.

---

## Start here: the document map (read in this order)

1. `CLAUDE.md` — orientation, ground rules, project identity
2. `context.md` — current project state and decisions
3. Latest block of `progress.md` — what the last session did
4. This file — how to work
5. `SECURITY_AUDIT_PLAYBOOK.md` — only when running or reviewing an audit

If any of these is missing or a pointer is stale, fixing the doc is in-scope work.

---

## The one habit that matters most: verify before you act

Most bad outcomes come from acting on a belief instead of a fact. Before you restart a service, delete a file, or "fix" a bug, ask: *have I actually observed the thing I'm about to respond to?*

- When you think a file says X, read it. When you think a permission is granted, query the live system. When you think a PR is unmerged, check the remote — not your local clone, which may be stale or authenticated as the wrong account.
- The repo is a *claim*. The running system is the *truth*. Where they disagree — and they will — the live system wins, and the disagreement is itself a finding.

---

## How to debug well

1. **Reproduce and localise before theorising.** Get the actual error text, the actual failing input, the actual log line. A theory you can't tie to an observation is a guess.
2. **Binary-search the problem space.** Halve the suspect surface each step — which layer? which Edge Function? which input? Don't read the whole codebase; find the one place the truth diverges.
3. **Change one thing at a time.** If you alter three things and it works, you don't know what fixed it.
4. **Read the error literally.** "permission denied" is an auth problem, not a logic problem; "not found" is access or addressing, not necessarily existence.
5. **Trust the type checker.** Run `npx tsc --noEmit` in `frontend/` before declaring done.
6. **Prefer the smallest correct fix.** Match the surrounding code's idiom, naming, and comment density.

---

## Environment bootstrap

- **Repo:** `jdsmartindiahackathon2026-lang/Nyaaya-AI`. Verify auth: `gh auth status` — correct account is `jdsmartindiahackathon2026-lang`.
- **Multiple gh accounts on this machine:** `vellumflux`, `joyjitdas2023`, `arcvltshop5671` also exist. Always verify active account before any gh operation.
- **Backend:** Supabase project `nrsfljvrtsnewkbufdid` (ap-southeast-1). MCP tool available for DB operations.
- **Run frontend locally:** `cd frontend && npm install && npm run dev`. Env vars in `frontend/.env.local` — never committed.
- **Only `NEXT_PUBLIC_*` vars** may reach client code.
- **Baseline check before touching anything:** `cd frontend && npx tsc --noEmit`

---

## Testing reality

No automated test suite exists yet. The bar is:
- `npx tsc --noEmit` clean in `frontend/`
- Manual verification of the changed flow in the browser
- Edge Functions: verify via Supabase dashboard logs after deploy

Never claim "tests pass" — say what was actually verified.

---

## Knowing this codebase

- **Stack:** Next.js 14 App Router (TypeScript), Supabase Edge Functions (Deno/TypeScript), Supabase PostgreSQL, Tailwind CSS
- **Security spine (do not weaken):**
  - RLS on all 4 tables — policies enforce `auth.uid() = auth_id` chain
  - All user identity comes from Supabase Auth JWT — never from request body
  - Supabase anonymous auth for hackathon demo — no passwords stored
  - Secret keys live only in Supabase Edge Function Secrets
  - `approved_sources.json` whitelist passed on every Perplexity call — structural hallucination prevention
- **Deliberate decisions — don't re-suggest:**
  - Anonymous auth (no user registration) — deliberate for demo UX
  - Google Translate instead of Bhashini — simpler integration, same quality at demo scale
  - Perplexity Sonar base model (not Pro) — cost constraint ($5 prepaid credits)
  - Frontend page stubs are intentionally empty — design is handled by Stitch/Claude Design team

### Data / schema map

| Table | Purpose | Ownership column |
|---|---|---|
| `users` | Onboarding profile per session | `auth_id` → `auth.users.id` |
| `conversations` | Chat sessions | `user_id` → `users.id` |
| `messages` | Individual messages + citations | `conversation_id` → `conversations.id` |
| `escalations` | Human facilitator requests | `user_id` → `users.id` |

### Highest-stakes surface

The Perplexity API call in `ask-query` — a bug here that bypasses `approved_sources.json` could return hallucinated legal citations presented as authoritative. Any change to the system prompt or domain filter in `ask-query/index.ts` is high-stakes and must be reviewed carefully.

---

## Git & workflow discipline

- **Never commit or push to `main`.** Branch first: `feature/…`, `fix/…`, `chore/…`.
- Push only when the user asks.
- Commit email: `jdsmartindiahackathon2026@gmail.com`
- **Merging PRs is the user's job.** You open them; they merge.
- Rebasing a stale branch onto updated main after merges is normal — do it, re-run `tsc --noEmit`, then push.

---

## Working autonomously

- Do reversible, in-scope work without asking. Stop for destructive or outward-facing actions (deleting data, deploying Edge Functions, publishing) unless clearly authorised.
- Don't end a turn on a promise. Do the thing, then report.
- Report faithfully: if a check failed, say so; if something is unverified, label it.

### Security emergency protocol

If you discover a **live, actively exploitable, critical** issue mid-session: stop other work, prepare the fix on a branch immediately, and put it at the TOP of your report labelled **CRITICAL**. Do not deploy or merge yourself. Exception: revoking a confirmed-leaked credential is containment — do it, then report prominently.

---

## A parting note

Be honest over being impressive. Every shortcut in security is a debt someone else pays. When unsure, dig one level deeper than feels necessary. Leave the codebase, and these notes, a little clearer than you found them.
