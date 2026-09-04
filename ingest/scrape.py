"""
scrape.py — pull section list + full-text bitstream for each act in sources.yaml.

Writes:
  scraped/raw/<act_id>/sections.json  — DSpace section metadata
  scraped/raw/<act_id>/act.pdf        — the full act PDF
  scraped/raw/<act_id>/full-text.txt  — text extracted from act.pdf via pypdf
                                        (with form-feed page breaks preserved)
  scraped/raw/<act_id>/pdf-info.json  — {pdf_uuid, pdf_url, pdf_name} for deep links

Note: IndiaCode also exposes a pre-extracted TEXT bitstream, but it is capped
at ~100 KB per act — everything past that is silently truncated. Parsing the
PDF ourselves is the only way to get the full text of longer acts.

Run: python ingest/scrape.py [--only patents-act-1970]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import httpx
import yaml

BASE = "https://indiacode.gov.in/server/api"
ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "scraped" / "raw"

# Long timeout — some acts are big and IndiaCode's server is slow.
CLIENT = httpx.Client(timeout=60.0, follow_redirects=True, headers={
    "User-Agent": "NyaayaAI-Ingest/1.0 (research; contact via github repo)"
})


def fetch_sections(act_id: str) -> list[dict]:
    """Page through Discover API until all sections are collected."""
    all_items: list[dict] = []
    page = 0
    size = 100
    while True:
        r = CLIENT.get(
            f"{BASE}/discover/search/objects",
            params={
                "sort": "dc.identifier.order_number,ASC",
                "page": page,
                "size": size,
                "f.identifier_collection": "SECTION,equals",
                "f.act_id": f"{act_id},equals",
            },
        )
        r.raise_for_status()
        data = r.json()
        objs = (
            data.get("_embedded", {})
            .get("searchResult", {})
            .get("_embedded", {})
            .get("objects", [])
        )
        if not objs:
            break
        for o in objs:
            item = o.get("_embedded", {}).get("indexableObject", {})
            if item:
                all_items.append(item)
        page_info = data.get("_embedded", {}).get("searchResult", {}).get("page", {})
        total_pages = page_info.get("totalPages", 1)
        page += 1
        if page >= total_pages:
            break
    return all_items


def _md(item: dict, key: str) -> str | None:
    """Read the first value of a DSpace metadata field, or None."""
    entries = item.get("metadata", {}).get(key)
    if not entries:
        return None
    return entries[0].get("value")


def normalize_section(item: dict) -> dict:
    return {
        "uuid": item.get("uuid"),
        "handle": item.get("handle"),
        "section_number": _md(item, "dc.identifier.section_number"),
        "order_number": _md(item, "dc.identifier.order_number"),
        "title": _md(item, "dc.title") or item.get("name"),
        "page_number": _md(item, "dc.identifier.page_number"),
        "page_from": _md(item, "dc.identifier.page_from"),
        "page_to": _md(item, "dc.identifier.page_to"),
        "next_section": _md(item, "dc.identifier.next_section"),
        "act_repealed": _md(item, "dc.identifier.act_repealed"),
        "repealed": _md(item, "dc.identifier.repealed"),
    }


def fetch_bundles(act_uuid: str) -> list[dict]:
    r = CLIENT.get(f"{BASE}/core/items/{act_uuid}/bundles")
    r.raise_for_status()
    return r.json().get("_embedded", {}).get("bundles", [])


def fetch_bitstreams(bundle_uuid: str) -> list[dict]:
    r = CLIENT.get(f"{BASE}/core/bundles/{bundle_uuid}/bitstreams")
    r.raise_for_status()
    return r.json().get("_embedded", {}).get("bitstreams", [])


def fetch_pdf(act_uuid: str) -> tuple[bytes, dict]:
    """Download the ORIGINAL PDF for an act. Return (pdf_bytes, pdf_info)."""
    bundles = fetch_bundles(act_uuid)
    original_bundle = next((b for b in bundles if b.get("name") == "ORIGINAL"), None)
    if not original_bundle:
        raise RuntimeError(f"No ORIGINAL (PDF) bundle for act {act_uuid}")

    pdf_bs = fetch_bitstreams(original_bundle["uuid"])
    if not pdf_bs:
        raise RuntimeError(f"ORIGINAL bundle empty for act {act_uuid}")

    # Prefer the English PDF when multiple language variants exist. IndiaCode
    # convention: filenames starting with lowercase `a` (e.g. a1940-23.pdf) are
    # English; leading `H` (H1940-23.pdf) are Hindi.
    english = next(
        (b for b in pdf_bs if b.get("name", "").split(".")[0].lower().startswith("a")),
        None,
    )
    chosen = english or pdf_bs[0]

    pdf_url = f"{BASE}/core/bitstreams/{chosen['uuid']}/content"
    pdf_bytes = CLIENT.get(pdf_url).content
    pdf_info = {
        "pdf_uuid": chosen["uuid"],
        "pdf_name": chosen["name"],
        "pdf_content_url": pdf_url,
        "pdf_size_bytes": chosen.get("sizeBytes"),
    }
    return pdf_bytes, pdf_info


def extract_pdf_text(pdf_path: Path) -> str:
    """
    Extract text from a PDF, one page at a time, joined with form-feed (\x0c)
    so the chunker can locate page boundaries.
    """
    from pypdf import PdfReader
    reader = PdfReader(str(pdf_path))
    pages = []
    for page in reader.pages:
        try:
            pages.append(page.extract_text() or "")
        except Exception as e:
            pages.append(f"\n[extraction error: {e}]\n")
    return "\x0c".join(pages)


def scrape_act(cfg: dict) -> None:
    act_id = cfg["id"]
    print(f"\n== {act_id} ({cfg['display']}) ==")
    out_dir = RAW_DIR / act_id
    out_dir.mkdir(parents=True, exist_ok=True)

    print("  fetching section list...")
    raw_sections = fetch_sections(cfg["act_id"])
    sections = [normalize_section(s) for s in raw_sections]
    (out_dir / "sections.json").write_text(
        json.dumps(sections, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"  -> {len(sections)} sections")

    print("  downloading PDF...")
    pdf_bytes, pdf_info = fetch_pdf(cfg["act_uuid"])
    pdf_path = out_dir / "act.pdf"
    pdf_path.write_bytes(pdf_bytes)
    (out_dir / "pdf-info.json").write_text(
        json.dumps(pdf_info, indent=2), encoding="utf-8"
    )
    print(f"  -> PDF {len(pdf_bytes):,} bytes")

    print("  extracting text via pypdf...")
    full_text = extract_pdf_text(pdf_path)
    (out_dir / "full-text.txt").write_text(full_text, encoding="utf-8")
    print(f"  -> {len(full_text):,} chars text")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", help="Restrict to a single act id from sources.yaml")
    args = parser.parse_args()

    sources = yaml.safe_load((Path(__file__).parent / "sources.yaml").read_text(encoding="utf-8"))
    acts = sources["acts"]
    if args.only:
        acts = [a for a in acts if a["id"] == args.only]
        if not acts:
            print(f"No act with id={args.only!r} in sources.yaml", file=sys.stderr)
            return 2

    for cfg in acts:
        if "act_uuid" not in cfg or cfg.get("act_uuid") in (None, "TBD"):
            print(f"[skip] {cfg['id']} — act_uuid not filled")
            continue
        try:
            scrape_act(cfg)
        except Exception as e:
            print(f"[error] {cfg['id']}: {e}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
