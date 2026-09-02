# Agent Guide — Nyaaya AI / IP-SAKTI

**Who this applies to:** Claude Code, Antigravity, Codex, or any AI agent working on this project.

---

## Start here: read in this order

1. This file (`CLAUDE.md`) — orientation and ground rules
2. `ENGINEERING_PRINCIPLES.md` — how to work, debug, and make decisions
3. `SECURITY_AUDIT_PLAYBOOK.md` — security audit protocol (load only when auditing)
4. `context.md` — current project state and open decisions (create if missing)
5. Latest block of `progress.md` — what the last session did

If any of these is missing or stale, fixing the doc is in-scope work.

---

## Project identity

- **Product:** Nyaaya AI — AI-powered Ayurveda IP and regulatory guidance assistant
- **Team:** Palimpsest — SIH 2026, Problem Statement SIH26045, submission at NSEC
- **Repo:** `jdsmartindiahackathon2026-lang/Nyaaya-AI` (private)
- **Supabase project ID:** `nrsfljvrtsnewkbufdid`
- **Correct gh CLI account:** `jdsmartindiahackathon2026-lang`
- **Frontend deploy:** Vercel (from `main` branch, `frontend/` directory)

## Stack (do not deviate)

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) + Stitch UI + Tailwind CSS |
| Backend | Supabase Edge Functions (Deno runtime) — never Python/FastAPI |
| Database | Supabase PostgreSQL + RLS |
| Auth | Supabase anonymous auth (`signInAnonymously`) |
| Primary AI | Perplexity API (Sonar model) |
| Mini Guide AI | Groq API (Llama 3.3-70b) |
| Translation | Google Translate API |

## Absolute ground rules (non-negotiable)

1. **Never commit or push directly to `main`.** Branch first: `feature/…`, `fix/…`, `chore/…`. Open a PR and wait for the user to review and merge.
2. **Never commit `.env`, `.env.local`, or any file containing secrets.** They are gitignored. If you ever detect a secret in the tree, flag it as CRITICAL immediately.
3. **All user passwords are managed by Supabase Auth** — never store, log, or transmit raw passwords anywhere. Supabase handles bcrypt hashing. Never roll custom auth.
4. **Secret API keys** (Perplexity, Groq, Google Translate, Supabase service role) live ONLY in Supabase Edge Function Secrets. Never put them in the frontend or any committed file.
5. **Only `NEXT_PUBLIC_*` variables** may reach client/frontend code.
6. **Merging PRs is the user's job.** You open them; they merge.

## Session discipline

- At the end of every session, update `progress.md` with what was done, what was verified, what is pending, and any decisions made.
- At the start of every session, read `progress.md` (latest block) before touching anything.
- Always read PRD (`ip_sakti_prd.md`) and TRD (`nyaaya_ai_trd.md`) before making architectural decisions.
