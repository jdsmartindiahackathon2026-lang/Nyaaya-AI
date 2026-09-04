"""
load.py — batch upsert embedded chunks from scraped/chunks/*.embedded.jsonl
         into the Supabase public.statute_chunks pgvector table.

Prerequisites:
  - pgvector migration applied (Session 10)
  - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars set

Run:
  python ingest/load.py
  python ingest/load.py --only patents-act-1970
  python ingest/load.py --dry-run
  python ingest/load.py --chunks-dir /path/to/chunks

Idempotent — upserts on `id`; safe to re-run.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CHUNKS_DIR = ROOT / "scraped" / "chunks"

BATCH_SIZE = 200
EMBEDDING_DIM = 384


def _build_row(obj: dict) -> dict:
    clause = obj.get("clause_id") or obj["section_number"]
    return {
        "id": f"{obj['statute_id']}::{clause}",
        "statute_id": obj["statute_id"],
        "statute_display": obj["statute_display"],
        "section_number": obj["section_number"],
        "section_title": obj.get("section_title"),
        "clause_id": obj.get("clause_id"),
        "text": obj["text"],
        "page_number": obj.get("page_number"),
        "citation_url": obj.get("citation_url"),
        "deep_link": obj.get("deep_link"),
        "embedding": obj["embedding"],  # list[float] len 384
    }


def _upsert_batch(supabase, batch: list[dict]) -> None:
    """Upsert a batch; fall back to string-encoded embeddings on type error."""
    try:
        supabase.table("statute_chunks").upsert(batch, on_conflict="id").execute()
    except Exception as exc:
        if "type" in str(exc).lower() or "vector" in str(exc).lower():
            # supabase-py didn't accept list[float] — stringify the embedding
            fallback = []
            for row in batch:
                r = dict(row)
                emb = r["embedding"]
                r["embedding"] = "[" + ",".join(map(str, emb)) + "]"
                fallback.append(r)
            supabase.table("statute_chunks").upsert(fallback, on_conflict="id").execute()
        else:
            raise


def load_file(path: Path, supabase, dry_run: bool) -> int:
    lines = [l for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]
    if not lines:
        print(f"  [skip] {path.name} — empty")
        return 0

    rows = []
    errors = 0
    for i, line in enumerate(lines, 1):
        try:
            obj = json.loads(line)
        except json.JSONDecodeError as e:
            print(f"  [warn] {path.name} line {i}: JSON decode error — {e}", file=sys.stderr)
            errors += 1
            continue

        try:
            row = _build_row(obj)
        except KeyError as e:
            print(f"  [warn] {path.name} line {i}: missing field {e}", file=sys.stderr)
            errors += 1
            continue

        emb = row["embedding"]
        if not isinstance(emb, list) or len(emb) != EMBEDDING_DIM:
            print(
                f"  [warn] {path.name} line {i}: embedding dim={len(emb) if isinstance(emb, list) else '?'} expected {EMBEDDING_DIM}",
                file=sys.stderr,
            )
            errors += 1
            continue

        rows.append(row)

    if dry_run:
        print(f"  [dry-run] {path.name}: {len(rows)} valid rows ({errors} skipped)")
        return len(rows)

    uploaded = 0
    for start in range(0, len(rows), BATCH_SIZE):
        batch = rows[start : start + BATCH_SIZE]
        _upsert_batch(supabase, batch)
        uploaded += len(batch)

    print(f"  {path.name}: {uploaded} rows upserted")
    return uploaded


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Batch upsert embedded chunks to Supabase pgvector."
    )
    parser.add_argument("--only", metavar="STATUTE_ID", help="Process only this statute's file")
    parser.add_argument("--dry-run", action="store_true", help="Parse and validate only — no writes")
    parser.add_argument(
        "--chunks-dir",
        metavar="PATH",
        default=str(DEFAULT_CHUNKS_DIR),
        help=f"Directory containing *.embedded.jsonl files (default: {DEFAULT_CHUNKS_DIR})",
    )
    args = parser.parse_args()

    # --- env validation (fail fast) ---
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url:
        print("ERROR: SUPABASE_URL env var is not set.", file=sys.stderr)
        return 1
    if not key:
        print("ERROR: SUPABASE_SERVICE_ROLE_KEY env var is not set.", file=sys.stderr)
        return 1

    chunks_dir = Path(args.chunks_dir)
    if not chunks_dir.is_dir():
        print(f"ERROR: chunks dir not found: {chunks_dir}", file=sys.stderr)
        return 1

    files = sorted(chunks_dir.glob("*.embedded.jsonl"))
    if args.only:
        files = [f for f in files if f.stem.removesuffix(".embedded") == args.only or f.stem == args.only + ".embedded"]
        if not files:
            print(f"ERROR: no embedded file found for statute_id '{args.only}'", file=sys.stderr)
            return 1

    if not files:
        print("ERROR: no *.embedded.jsonl files found — run embed.py first.", file=sys.stderr)
        return 1

    if args.dry_run:
        print(f"[dry-run mode] validating {len(files)} file(s), no writes.")
        supabase = None
    else:
        # Import here so --help / --dry-run don't require supabase installed
        from supabase import create_client
        supabase = create_client(url, key)
        print(f"Connected to {url}")
        print(f"Uploading {len(files)} file(s)...")

    grand_total = 0
    for path in files:
        count = load_file(path, supabase, dry_run=args.dry_run)
        grand_total += count

    verb = "validated" if args.dry_run else "Uploaded"
    print(f"\n{verb} {grand_total} rows across {len(files)} files.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
