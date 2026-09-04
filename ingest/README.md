# ingest — offline pipeline for the hybrid RAG corpus

Scrapes IndiaCode, chunks statutes into per-clause records, and embeds them
locally. Output goes to `scraped/chunks/*.embedded.jsonl` at the repo root.

**Runs on your laptop only — never deployed.** The runtime backend stays Deno /
Edge Functions per `CLAUDE.md`. A separate `load.py` (next PR) will upsert the
embedded chunks to Supabase pgvector.

## Setup

```bash
python -m venv .venv
.venv\Scripts\activate            # PowerShell / cmd
# .venv/bin/activate               # bash
pip install -r ingest/requirements.txt
```

First run downloads the embedding model (~130 MB, cached in
`~/.cache/huggingface/`).

## Pipeline

Run each stage. `--only <id>` restricts to one act from `sources.yaml`.

```bash
python ingest/scrape.py --only patents-act-1970
python ingest/chunk.py  --only patents-act-1970
python ingest/embed.py  --only patents-act-1970
```

Outputs (relative to repo root):

```
scraped/
├── raw/patents-act-1970/
│   ├── sections.json         # DSpace metadata per section
│   ├── full-text.txt         # pre-extracted plain text of the whole act
│   └── pdf-info.json         # PDF bitstream UUID + URL for deep links
└── chunks/
    ├── patents-act-1970.jsonl              # section + clause chunks (no vectors)
    └── patents-act-1970.embedded.jsonl     # same + 384-dim embedding
```

`scraped/raw/` is gitignored (large, regeneratable). `scraped/chunks/` is
committed — it's the source of truth for what lives in pgvector.

## Chunking strategy

One chunk per **top-level clause** (`3`, `3(a)`, `3(b)`, ..., `3(p)`). The
section stem (definition line before the first clause) is its own chunk keyed
on the bare section number. Sections with no `(a)`-style markers become a
single chunk.

Each chunk carries:

| Field | Purpose |
|---|---|
| `statute_id`, `statute_display` | For citation display + filtering |
| `section_number`, `section_title`, `clause_id` | Deterministic citation shape |
| `text` | Clean clause body — what the LLM sees at synthesis time |
| `page_number` | Location in the source PDF |
| `citation_url` | `https://indiacode.gov.in/act/<uuid>/sections` |
| `deep_link` | `<pdf_url>#page=<N>` — opens the PDF at the exact page |
| `embedding` | 384-dim `BAAI/bge-small-en-v1.5`, cosine-normalised |

At embed time only, a header is prepended to preserve parent context:
`Patents Act, 1970 — §3 (What are not inventions) — clause (p)\n<text>`.

## Adding an act

1. Find it on <https://indiacode.gov.in/home>.
2. Open its sections page — copy the UUID from the URL
   (`/act/<UUID>/sections`).
3. Open DevTools → Network → filter `discover` — copy the `act_id` from any
   `f.act_id=` query parameter.
4. Add a new entry to `sources.yaml` following the Patents Act template.
5. Re-run the three pipeline stages.

## Retrieval query prefix

`bge-small-en-v1.5` expects **queries** to be prefixed `"query: "` but not
passages. The runtime retrieval Edge Function must apply this — the ingest
side already treats every chunk as a passage.

## Load stage

`load.py` reads the `*.embedded.jsonl` files produced by the embed stage and
upserts every chunk to the `public.statute_chunks` pgvector table in Supabase.

### Prerequisites

- pgvector migration applied to the remote project (done Session 10).
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` env vars set. Get the
  service role key from **Supabase dashboard → Project Settings → API →
  service_role**. Never commit it.

```bash
export SUPABASE_URL=https://<project-ref>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

### Command

```bash
python ingest/load.py                          # upload all acts
python ingest/load.py --only patents-act-1970  # one act only
python ingest/load.py --dry-run                # validate without writing
python ingest/load.py --chunks-dir /other/dir  # custom input directory
```

### Notes

- **Idempotent** — upserts on the `id` primary key (`<statute_id>::<clause_id>`).
  Re-running never duplicates rows.
- Processes `BATCH_SIZE=200` rows per request to stay within Supabase limits.
- Run this locally (on Joyjit's machine) with the service role key from the
  Supabase dashboard. The key must never be committed or deployed.
