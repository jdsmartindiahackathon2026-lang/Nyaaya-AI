"""
chunk_pdf.py — chunk single-PDF sources into per-unit records.

Reads scraped/raw/<id>/{full-text.txt, pdf-info.json} produced by scrape_pdf.py
and emits scraped/chunks/<id>.jsonl in the same shape as chunk.py (so the
embedder + retrieval pipeline consume both interchangeably).

`chunk_pattern` from pdf-info.json picks the splitter:
  rule       — matches Indian Rules ("Rule N." / "N. Heading." / "N. Heading.—body")
  article    — matches treaty Articles ("Article N" / "Article N.N" / "Article N Heading")
  regulation — matches numbered regulations (fallback: same as rule)
  paragraph  — fixed ~1000-char paragraph fallback for unstructured PDFs

Run: python ingest/chunk_pdf.py [--only <source_id>]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "scraped" / "raw"
OUT_DIR = ROOT / "scraped" / "chunks"


# --- pattern definitions ------------------------------------------------------

# "Rule 5." / "5. Short title.—" / "12A. Explanation."
_RULE_HEAD = re.compile(
    r"(?:^|\n)\s*(?:Rule\s+)?(\d{1,3}[A-Z]{0,2})\.\s+"
    r"([A-Z][^\n]{3,180}?)\s*\.?\s*[—–�\n]",
    re.MULTILINE,
)

# "Article 27" / "Article 27.1" / "Article 27 Patentable Subject Matter"
# Treaties use bare "Article N" as heading; body follows on the next line or two.
_ARTICLE_HEAD = re.compile(
    r"(?:^|\n)\s*Article\s+(\d{1,3}(?:\.\d{1,3})?)"
    r"(?:\s*[:\-—]|\s+([A-Z][^\n]{2,180}))?",
    re.MULTILINE,
)


def normalise_whitespace(text: str) -> str:
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def chunk_rule(text: str) -> list[tuple[str, str, str]]:
    """
    Yield (unit_number, unit_title, unit_body) for each rule/regulation.
    Uses same header shape as Indian Acts — number, title, separator.
    """
    matches = list(_RULE_HEAD.finditer(text))
    if not matches:
        return []
    out: list[tuple[str, str, str]] = []
    for i, m in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        num = m.group(1)
        title = re.sub(r"\s+", " ", m.group(2)).strip().rstrip(".")
        body = text[m.end() : end].strip()
        if len(body) >= 15:
            out.append((num, title, body))
    return out


def chunk_article(text: str) -> list[tuple[str, str, str]]:
    """One chunk per Article. Title may be missing (some treaty layouts)."""
    matches = list(_ARTICLE_HEAD.finditer(text))
    if not matches:
        return []
    out: list[tuple[str, str, str]] = []
    for i, m in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        num = m.group(1)
        title_raw = m.group(2) or ""
        title = re.sub(r"\s+", " ", title_raw).strip().rstrip(".") or f"Article {num}"
        body = text[m.end() : end].strip()
        if len(body) >= 15:
            out.append((num, title, body))
    return out


def chunk_paragraph(text: str, target: int = 1000) -> list[tuple[str, str, str]]:
    """
    Fallback: split into ~`target`-char paragraphs on paragraph boundaries.
    Unit numbers are synthetic (p1, p2, ...).
    """
    paragraphs = re.split(r"\n\s*\n+", text)
    chunks: list[tuple[str, str, str]] = []
    buf = ""
    count = 0
    for p in paragraphs:
        p = p.strip()
        if not p:
            continue
        if len(buf) + len(p) + 2 <= target or not buf:
            buf = f"{buf}\n\n{p}".strip() if buf else p
        else:
            count += 1
            chunks.append((f"p{count}", "", buf))
            buf = p
    if buf:
        count += 1
        chunks.append((f"p{count}", "", buf))
    return chunks


CHUNKERS = {
    "rule": chunk_rule,
    "regulation": chunk_rule,
    "article": chunk_article,
    "paragraph": chunk_paragraph,
}


def chunk_one(source_id: str) -> int:
    raw = RAW_DIR / source_id
    info_path = raw / "pdf-info.json"
    text_path = raw / "full-text.txt"
    if not info_path.exists() or not text_path.exists():
        print(f"[skip] {source_id} — run scrape_pdf.py first", file=sys.stderr)
        return 0

    info = json.loads(info_path.read_text(encoding="utf-8"))
    text = text_path.read_text(encoding="utf-8")
    pattern = info["chunk_pattern"]
    chunker = CHUNKERS.get(pattern)
    if chunker is None:
        print(f"[skip] {source_id} — unknown chunk_pattern {pattern!r}", file=sys.stderr)
        return 0

    units = chunker(text)
    if not units:
        print(f"[warn] {source_id}: {pattern} chunker found nothing — falling back to paragraph")
        units = chunk_paragraph(text)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / f"{source_id}.jsonl"

    seen: dict[str, int] = {}
    with out_path.open("w", encoding="utf-8") as f:
        for num, title, body in units:
            body_clean = normalise_whitespace(body)
            if len(body_clean) < 15:
                continue
            base_id = num
            seen[base_id] = seen.get(base_id, 0) + 1
            clause_id = base_id if seen[base_id] == 1 else f"{base_id}-{seen[base_id]}"
            record = {
                "statute_id": source_id,
                "statute_display": info["display"],
                "section_number": num,
                "section_title": title,
                "clause_id": clause_id,
                "text": body_clean,
                "page_number": None,
                "citation_url": info["citation_url"],
                "deep_link": info["pdf_url"],
                "jurisdiction": info.get("jurisdiction", "india"),
            }
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
    n = sum(1 for _ in out_path.open(encoding="utf-8"))
    print(f"  {source_id}: {n} chunks -> {out_path.relative_to(ROOT)}")
    return n


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", help="Restrict to a single source id")
    args = parser.parse_args()

    import yaml
    sources = yaml.safe_load(
        (Path(__file__).parent / "pdf_sources.yaml").read_text(encoding="utf-8")
    )
    ids = [
        e["id"]
        for e in (sources.get("sources") or [])
        if e.get("pdf_url") and e["pdf_url"] != "TBD"
    ]
    if args.only:
        ids = [i for i in ids if i == args.only]

    total = 0
    for sid in ids:
        total += chunk_one(sid)
    print(f"\nTotal PDF-source chunks: {total}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
