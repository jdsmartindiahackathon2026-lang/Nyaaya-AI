"""
scrape_pdf.py — single-PDF ingest for sources not covered by IndiaCode's Acts API.

Fetches each PDF listed in ingest/pdf_sources.yaml, extracts text via pypdf,
and stores under scraped/raw/<id>/. Feeds chunk_pdf.py.

Run: python ingest/scrape_pdf.py [--only <source_id>]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import httpx
import yaml

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "scraped" / "raw"

CLIENT = httpx.Client(
    timeout=90.0,
    follow_redirects=True,
    headers={"User-Agent": "NyaayaAI-Ingest/1.0 (research; contact via github repo)"},
)


def is_pdf(content: bytes) -> bool:
    return content[:5] == b"%PDF-"


def extract_pdf_text(pdf_path: Path) -> str:
    from pypdf import PdfReader
    reader = PdfReader(str(pdf_path))
    pages = []
    for page in reader.pages:
        try:
            pages.append(page.extract_text() or "")
        except Exception as e:
            pages.append(f"\n[extraction error: {e}]\n")
    return "\x0c".join(pages)


def scrape_one(cfg: dict) -> None:
    src_id = cfg["id"]
    print(f"\n== {src_id} ({cfg['display'][:60]}) ==")
    out_dir = RAW_DIR / src_id
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"  downloading {cfg['pdf_url']}")
    r = CLIENT.get(cfg["pdf_url"])
    r.raise_for_status()
    if not is_pdf(r.content):
        raise RuntimeError(
            f"Response is not a PDF (size={len(r.content)}, first bytes={r.content[:20]!r})"
        )
    pdf_bytes = r.content
    pdf_path = out_dir / "act.pdf"
    pdf_path.write_bytes(pdf_bytes)
    print(f"  -> PDF {len(pdf_bytes):,} bytes")

    print("  extracting text via pypdf...")
    text = extract_pdf_text(pdf_path)
    (out_dir / "full-text.txt").write_text(text, encoding="utf-8")
    print(f"  -> {len(text):,} chars text")

    (out_dir / "pdf-info.json").write_text(
        json.dumps(
            {
                "pdf_url": cfg["pdf_url"],
                "citation_url": cfg["citation_url"],
                "pdf_size_bytes": len(pdf_bytes),
                "chunk_pattern": cfg["chunk_pattern"],
                "jurisdiction": cfg.get("jurisdiction", "india"),
                "display": cfg["display"],
            },
            indent=2,
        ),
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", help="Restrict to a single source id")
    args = parser.parse_args()

    sources = yaml.safe_load(
        (Path(__file__).parent / "pdf_sources.yaml").read_text(encoding="utf-8")
    )
    entries = sources.get("sources", []) or []
    if args.only:
        entries = [e for e in entries if e["id"] == args.only]

    for cfg in entries:
        if not cfg.get("pdf_url") or cfg["pdf_url"] == "TBD":
            print(f"[skip] {cfg['id']} — pdf_url not filled")
            continue
        try:
            scrape_one(cfg)
        except Exception as e:
            print(f"[error] {cfg['id']}: {e}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
