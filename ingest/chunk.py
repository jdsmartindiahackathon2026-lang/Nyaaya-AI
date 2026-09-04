"""
chunk.py — turn scraped/raw/<act_id>/full-text.txt into per-clause JSONL chunks.

Strategy:
  1. Locate each section body in the full text by matching its header:
     `\n<section_number>. <title>.—` (em-dash marks start of body).
     Body runs until the next section header (or a schedule / annex marker).
  2. Within a section body, split into clauses by top-level markers `(a)`, `(b)`, ...
     If the section has no clauses, the whole body is a single chunk.

Writes:
  scraped/chunks/<act_id>.jsonl — one JSON object per line.

Each chunk includes:
  statute_id, statute_display, section_number, section_title,
  clause_id (e.g. "3(p)" or "3" for whole-section chunks),
  text, page_number, citation_url, deep_link

Run: python ingest/chunk.py [--only patents-act-1970]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "scraped" / "raw"
OUT_DIR = ROOT / "scraped" / "chunks"

# Marker at the start of a (possibly indented) line — subsection (numeric),
# clause (single letter), or sub-clause (roman numeral). Optional "N[" prefix
# is an amendment marker IndiaCode injects inline.
#
# Groups: (subsection, clause, roman)
_ROMAN_RE = r"(?:x{0,3}(?:ix|iv|v?i{1,3})|v)"  # i, ii, iii, iv ... xxx
MARKER_RE = re.compile(
    rf"(?:^|\n)\s*(?:\d+\[)?\(\s*"
    rf"(?:(\d{{1,3}}[A-Z]?)|([a-hj-uw-z])|({_ROMAN_RE}))"
    rf"\s*\)",
    re.MULTILINE | re.IGNORECASE,
)


def clean_title(title: str) -> str:
    """Trim trailing period, collapse whitespace."""
    return re.sub(r"\s+", " ", title.rstrip(".").strip())


# Separator between "<num>. <title>." and section body. IndiaCode uses em-dash,
# and the PDF-to-text extraction sometimes mangles it into the Unicode
# replacement character (�). We do NOT accept plain ASCII hyphens here — a
# hyphen appears inside footnote dates (e.g. "1-1-2005") and matching it would
# truncate section bodies early.
SEP_CLASS = r"[—–�]"

# Split a title into alphanumeric word tokens, discarding all punctuation.
# When re-joined with \W* between tokens the regex tolerates any punctuation
# drift between the API's title and the extracted text.
_WORD_RE = re.compile(r"[A-Za-z0-9]+")


def escape_for_regex(title: str, max_tokens: int | None = None) -> str:
    tokens = _WORD_RE.findall(title)
    if max_tokens:
        tokens = tokens[:max_tokens]
    return r"\W+".join(re.escape(t) for t in tokens)


def find_section_body(full_text: str, section_number: str, title: str) -> str | None:
    """
    Return the body text of one section, or None if the header can't be located.

    Two-pass match:
      1. Strict — full title + separator. Handles the common case.
      2. Loose — first 3 title tokens + up to 250 chars of anything + separator.
         Rescues titles where the extracted PDF text has extra words (e.g. API
         "Opposition to patent" → PDF "Opposition to the patent") or spurious
         in-word spaces from PDF layout ("specification s" instead of
         "specifications"). The `SEP_CLASS` at the end is the discriminator that
         keeps this from matching TOC lines.
    """
    clean = clean_title(title)
    strict_re = re.compile(
        rf"(?:^|\n)\s*(?:\d+\[)?{re.escape(section_number)}\.\s+"
        rf"{escape_for_regex(clean)}\s*\.?\s*{SEP_CLASS}",
        re.IGNORECASE,
    )
    m = strict_re.search(full_text)
    # Progressively loosen: try 3-token prefix, then 2, then 1.
    for n_tokens in (3, 2, 1):
        if m is not None:
            break
        loose_prefix = escape_for_regex(clean, max_tokens=n_tokens)
        if not loose_prefix:
            continue
        loose_re = re.compile(
            rf"(?:^|\n)\s*(?:\d+\[)?{re.escape(section_number)}\.\s+"
            rf"{loose_prefix}[\s\S]{{0,250}}?{SEP_CLASS}",
            re.IGNORECASE,
        )
        m = loose_re.search(full_text)
    if m is None:
        return None
    start = m.end()

    # Body ends at the next section header (any number) — a line beginning with
    # "<digits>[A-Z]?." followed by whitespace, a capitalised word, and one of
    # the separator chars. Or at a schedule / chapter divider.
    tail = full_text[start:]
    end_pat = re.compile(
        rf"(?:^|\n)\s*(?:\d+\[)?\d+[A-Z]{{0,2}}\.\s+[A-Z][^\n]{{3,150}}\.?\s*{SEP_CLASS}"
        r"|(?:^|\n)\s*(?:THE\s+)?(?:FIRST|SECOND|THIRD|FOURTH|FIFTH)\s+SCHEDULE"
        r"|(?:^|\n)\s*SCHEDULE\s+[IVX]",
    )
    end_m = end_pat.search(tail)
    body = tail[: end_m.start()] if end_m else tail
    return body.strip()


def split_clauses(section_number: str, section_body: str) -> list[tuple[str, str]]:
    """
    Return [(clause_id, clause_text), ...] with hierarchical IDs.

    Detects three marker levels:
      - subsection: (1), (2), (3) ...            numeric
      - clause:     (a), (b), (c) ...            single letter (excl. i/v/x)
      - sub-clause: (i), (ii), (iii), (iv) ...   roman numeral

    IDs walk the hierarchy so citations are unique:
      84, 84(1), 84(1)(a), 84(1)(a)(i), 84(1)(b), 84(2), 84(6)(i), ...

    If the body has no markers, returns one chunk with clause_id == section_number.
    """
    markers: list[list] = []  # [position, level, token]
    for m in MARKER_RE.finditer(section_body):
        if m.group(1) is not None:
            markers.append([m.start(), "subsection", m.group(1)])
        elif m.group(2) is not None:
            markers.append([m.start(), "clause", m.group(2).lower()])
        elif m.group(3) is not None:
            markers.append([m.start(), "sub-clause", m.group(3).lower()])

    if not markers:
        return [(section_number, section_body.strip())]

    # Reclassify: `(i)/(v)/(x)` matched as sub-clause is actually a top-level
    # clause letter when the preceding marker was a clause letter (h, u, w).
    # Section 3 goes ...(g)(h)(i)(j)(k)... — the (i) is not roman-numeral 1.
    _ambiguous = {"i", "v", "x"}
    _letter_before = {"i": "h", "v": "u", "x": "w"}
    for i, mk in enumerate(markers):
        if mk[1] == "sub-clause" and mk[2] in _ambiguous:
            # Look at previous marker (any level)
            prev = markers[i - 1] if i > 0 else None
            if prev and prev[1] == "clause" and prev[2] == _letter_before[mk[2]]:
                mk[1] = "clause"

    stem = section_body[: markers[0][0]].strip()

    chunks: list[tuple[str, str]] = []
    if stem:
        chunks.append((section_number, stem))

    # Walk markers and maintain a path of tokens by level.
    level_order = {"subsection": 0, "clause": 1, "sub-clause": 2}
    path: list[str] = []  # tokens from most-recent subsection down
    path_levels: list[int] = []

    for i, (pos, level, tok) in enumerate(markers):
        end = markers[i + 1][0] if i + 1 < len(markers) else len(section_body)
        this_level = level_order[level]
        # Pop path entries that are same-or-deeper level than this marker
        while path_levels and path_levels[-1] >= this_level:
            path.pop()
            path_levels.pop()
        path.append(tok)
        path_levels.append(this_level)

        clause_id = section_number + "".join(f"({t})" for t in path)
        chunks.append((clause_id, section_body[pos:end].strip()))
    return chunks


def normalise_whitespace(text: str) -> str:
    # Collapse repeated blank lines and stray runs of spaces from PDF extraction
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def chunk_act(cfg: dict, act_uuid: str) -> int:
    act_id = cfg["id"]
    raw = RAW_DIR / act_id
    full_text_path = raw / "full-text.txt"
    sections_path = raw / "sections.json"
    pdf_info_path = raw / "pdf-info.json"

    if not full_text_path.exists() or not sections_path.exists():
        print(f"[skip] {act_id} — run scrape.py first", file=sys.stderr)
        return 0

    full_text = full_text_path.read_text(encoding="utf-8")
    sections = json.loads(sections_path.read_text(encoding="utf-8"))
    pdf_info = json.loads(pdf_info_path.read_text(encoding="utf-8"))

    citation_url = f"https://indiacode.gov.in/act/{act_uuid}/sections"
    pdf_deep_base = pdf_info["pdf_content_url"]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / f"{act_id}.jsonl"

    # Titles that mark deliberately empty sections — repealed or omitted.
    # Skipping them isn't a miss.
    empty_re = re.compile(r"^\s*\[?\s*(Omitted|Repealed|Appellate Board)", re.IGNORECASE)

    written = 0
    missed: list[str] = []
    skipped_empty = 0
    with out_path.open("w", encoding="utf-8") as f:
        for sec in sections:
            sec_num = sec.get("section_number")
            title = sec.get("title") or ""
            if not sec_num or not title:
                continue
            if empty_re.match(title):
                skipped_empty += 1
                continue
            body = find_section_body(full_text, sec_num, title)
            if body is None:
                # Second-chance: sections repealed by later amendments appear as
                # `<num>. [<original title>.] Omitted by ...` — no separator, so
                # find_section_body can't reach them. Detect and skip as empty.
                repealed = re.search(
                    rf"(?:^|\n)\s*{re.escape(sec_num)}\.\s*\[[^\]]{{5,200}}\]\s*Omitted\s+by",
                    full_text,
                )
                if repealed:
                    skipped_empty += 1
                    continue
                missed.append(f"{sec_num} {title!r}")
                continue

            page_number = None
            try:
                page_number = int(sec["page_number"]) if sec.get("page_number") else None
            except (TypeError, ValueError):
                pass
            deep_link = (
                f"{pdf_deep_base}#page={page_number}" if page_number else pdf_deep_base
            )

            seen_ids: dict[str, int] = {}
            for clause_id, clause_text in split_clauses(sec_num, body):
                clean = normalise_whitespace(clause_text)
                if len(clean) < 15:
                    # Skip empty or degenerate fragments (e.g. `[Omitted.]`)
                    continue
                # Dedupe: if the same id appears again within a section (usually
                # a proviso or explanation that restarts the numbering), suffix
                # with -2, -3, ... The second-proviso case is real; distinct ids
                # keep pgvector rows unique.
                seen_ids[clause_id] = seen_ids.get(clause_id, 0) + 1
                if seen_ids[clause_id] > 1:
                    clause_id = f"{clause_id}-{seen_ids[clause_id]}"
                record = {
                    "statute_id": act_id,
                    "statute_display": cfg["display"],
                    "act_uuid": act_uuid,
                    "section_number": sec_num,
                    "section_title": clean_title(title),
                    "clause_id": clause_id,
                    "text": clean,
                    "page_number": page_number,
                    "citation_url": citation_url,
                    "deep_link": deep_link,
                }
                f.write(json.dumps(record, ensure_ascii=False) + "\n")
                written += 1

    print(f"  {act_id}: {written} chunks -> {out_path.relative_to(ROOT)}"
          f" (skipped {skipped_empty} omitted/repealed)")
    if missed:
        print(f"  [warn] {len(missed)} sections had no locatable body:")
        for s in missed[:10]:
            print(f"    - {s}")
        if len(missed) > 10:
            print(f"    ... and {len(missed) - 10} more")
    return written


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", help="Restrict to a single act id from sources.yaml")
    args = parser.parse_args()

    sources = yaml.safe_load((Path(__file__).parent / "sources.yaml").read_text(encoding="utf-8"))
    acts = sources["acts"]
    if args.only:
        acts = [a for a in acts if a["id"] == args.only]

    total = 0
    for cfg in acts:
        if not cfg.get("act_uuid") or cfg["act_uuid"] == "TBD":
            continue
        total += chunk_act(cfg, cfg["act_uuid"])
    print(f"\nTotal chunks written: {total}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
