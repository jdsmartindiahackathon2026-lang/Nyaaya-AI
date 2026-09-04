"""
embed.py — attach a local embedding vector to every chunk in scraped/chunks/*.jsonl.

Model: BAAI/bge-small-en-v1.5 (384 dims, ~130 MB, MIT). Chosen because it tops
MTEB in its size class and runs on CPU in a couple of minutes for the full corpus.

Each chunk is embedded with a small header prefixed to preserve parent context:
  "<statute_display> — §<section_number> (<section_title>) — clause <clause_id>\n<text>"
Only the embedding sees this header; the stored `text` field is unchanged.

Reads:  scraped/chunks/<act_id>.jsonl
Writes: scraped/chunks/<act_id>.embedded.jsonl (same records + `embedding` field)

Run: python ingest/embed.py [--only patents-act-1970]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from tqdm import tqdm

ROOT = Path(__file__).resolve().parent.parent
CHUNK_DIR = ROOT / "scraped" / "chunks"

MODEL_NAME = "BAAI/bge-small-en-v1.5"


def embed_input(chunk: dict) -> str:
    """Compose the string that gets embedded (parent context + clause text)."""
    header = (
        f"{chunk['statute_display']} — §{chunk['section_number']} "
        f"({chunk['section_title']}) — clause {chunk['clause_id']}"
    )
    return f"{header}\n{chunk['text']}"


def embed_file(path: Path, model) -> Path:
    out = path.with_name(path.stem + ".embedded.jsonl")
    records = [json.loads(l) for l in path.read_text(encoding="utf-8").splitlines() if l.strip()]
    if not records:
        print(f"  [skip] {path.name} — empty")
        return out

    texts = [embed_input(r) for r in records]
    # bge models expect no special query prefix for passages; only queries get "query: ".
    vectors = model.encode(
        texts,
        batch_size=32,
        show_progress_bar=True,
        normalize_embeddings=True,  # cosine similarity via dot product downstream
    )

    with out.open("w", encoding="utf-8") as f:
        for rec, vec in zip(records, vectors):
            rec["embedding"] = [float(x) for x in vec]
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    print(f"  {path.name}: {len(records)} chunks embedded -> {out.name}")
    return out


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", help="Restrict to a single act id")
    args = parser.parse_args()

    # Import here so a --help call doesn't pay the torch import cost.
    from sentence_transformers import SentenceTransformer

    print(f"Loading {MODEL_NAME}...")
    model = SentenceTransformer(MODEL_NAME)

    files = sorted(CHUNK_DIR.glob("*.jsonl"))
    files = [f for f in files if not f.name.endswith(".embedded.jsonl")]
    if args.only:
        files = [f for f in files if f.stem == args.only]

    if not files:
        print("No chunk files found — run chunk.py first.", file=sys.stderr)
        return 2

    for path in tqdm(files, desc="acts"):
        embed_file(path, model)
    return 0


if __name__ == "__main__":
    sys.exit(main())
