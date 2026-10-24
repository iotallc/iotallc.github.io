---
name: SEC Filing Diff
command: /sec-diff
version: "1.0"
category: Finance
editions: exe
editions_reason: "EXE edition. Downloading filings from SEC EDGAR needs the internet and the EXE edition's network access. If you already have two 10-K files saved on your PC, the comparison steps themselves run offline in either edition."
network: online
network_note: "Online to fetch from SEC EDGAR. Offline when you supply local files."
author: "IOTA - Joseph Bryant"
license: "Free to use, copy, and adapt with credit to IOTA - Joseph Bryant. Provided as is, without warranty. Not investment advice."
homepage: https://iotallc.github.io/skills/
---

# /sec-diff: SEC Filing Diff

Created by IOTA - Joseph Bryant. https://iotallc.github.io/

This file is a skill guide. It tells the model in IOTA how to do the job step by step. It is not a compiled program and it does not install anything. To use it, paste its text into an IOTA chat and then give your request, or read it and follow the steps yourself.

Not investment advice. The output describes what changed in public documents. It does not recommend buying or selling anything.

## Purpose

Compare two annual reports (Form 10-K) from the same company and show what changed, section by section: new and removed risk factors, changed wording in Management's Discussion and Analysis, and other sections you choose. Filings come from SEC EDGAR or from files you already have.

## When to use

- A new 10-K is out and you want to see what the company added, removed, or reworded since last year.
- Reviewing risk factor changes across several years.
- Preparing notes for research, with every change linked to the exact text.

## When not to use

- For quarterly numbers or XBRL financial data. This skill compares text sections.
- For non US filers that file 20-F or 40-F. The section names differ; the skill can try but says so.
- To make trading decisions on its own. It is a reading aid.

## Requirements

- EXE edition with network access for EDGAR mode.
- Python 3.10 or later with `requests` and `beautifulsoup4` (and `lxml` for speed).
- A descriptive User-Agent with your name or company and a contact email, which the SEC requires for automated access. The skill asks for it at the start, or reads it from a local config file you choose. Example: `Example Research admin@example.com`.
- Model: Gemma 3 12B or 27B or a Nemotron model summarizes changes well. Gemma 3 4B can label changes but its summaries of long sections are weaker, so the skill always shows the exact changed text too.

## Inputs

| Input | Required | Example |
|---|---|---|
| Ticker or CIK | EDGAR mode | `MSFT` or `0000789019` |
| Years | No | latest two 10-K filings (default) or `2024 2025` |
| Local files | Local mode | `old.htm`, `new.htm` |
| Sections | No | `1A 7` (default), any of `1 1A 1B 1C 2 3 5 7 7A 8 9A` |

## Step-by-step procedure

1. **Resolve the company** (EDGAR mode).
   ```python
   import time
   import requests

   UA = {"User-Agent": "Example Research admin@example.com"}   # the user's own value

   def get_json(url):
       r = requests.get(url, headers=UA, timeout=30)
       r.raise_for_status()
       time.sleep(0.2)          # stay well below the SEC's 10 requests per second limit
       return r.json()

   def cik_for(ticker: str) -> str:
       data = get_json("https://www.sec.gov/files/company_tickers.json")
       for row in data.values():
           if row["ticker"].upper() == ticker.upper():
               return str(row["cik_str"]).zfill(10)
       raise ValueError(f"Ticker {ticker} not found")
   ```

2. **List 10-K filings** from the submissions API and pick two.
   ```python
   def ten_ks(cik10: str) -> list[dict]:
       sub = get_json(f"https://data.sec.gov/submissions/CIK{cik10}.json")
       rec = sub["filings"]["recent"]
       out = []
       for i, form in enumerate(rec["form"]):
           if form in ("10-K", "10-K/A"):
               out.append({
                   "form": form,
                   "filed": rec["filingDate"][i],
                   "period": rec["reportDate"][i],
                   "accession": rec["accessionNumber"][i],
                   "doc": rec["primaryDocument"][i],
               })
       return out

   def doc_url(cik10: str, f: dict) -> str:
       return (f"https://www.sec.gov/Archives/edgar/data/{int(cik10)}/"
               f"{f['accession'].replace('-', '')}/{f['doc']}")
   ```
   Prefer original 10-K filings. If an amendment (10-K/A) exists for the same period, tell the user and ask which to use. Show the two chosen filings with dates and links before downloading.

3. **Download and save locally.** Save each document as `filings/<cik>_<period>.htm` so reruns do not download again. Ask before overwriting.

4. **Extract text.**
   ```python
   import re
   from bs4 import BeautifulSoup

   def to_text(html: str) -> str:
       soup = BeautifulSoup(html, "lxml")
       for t in soup(["script", "style"]):
           t.decompose()
       for t in soup.find_all(style=re.compile(r"display:\s*none", re.I)):
           t.decompose()          # hidden inline XBRL header blocks
       text = soup.get_text("\n")
       text = re.sub(r"[ \t\xa0]+", " ", text)
       return re.sub(r"\n\s*\n+", "\n\n", text).strip()
   ```

5. **Split into Items.** The table of contents also contains "Item 1A" lines, so take the **last** heading match that is followed by substantial text, which is usually the real section start.
   ```python
   ITEM = re.compile(r"^\s*item\s+(1a|1b|1c|1|2|3|4|5|6|7a|7|8|9a|9b|9c|9|10|11|12|13|14|15|16)\s*[.:]?\s*(.{0,80})$",
                     re.I | re.M)

   def sections(text: str) -> dict[str, str]:
       hits = [(m.start(), m.group(1).upper()) for m in ITEM.finditer(text)]
       starts = {}
       for i, (pos, item) in enumerate(hits):
           nxt = hits[i + 1][0] if i + 1 < len(hits) else len(text)
           if nxt - pos > 2000:             # skip table of contents lines
               starts[item] = (pos, nxt)
       return {k: text[a:b].strip() for k, (a, b) in starts.items()}
   ```
   If a requested section is missing in either filing, say so; do not compare the wrong text.

6. **Compare risk factors as units.** Split Item 1A into risk factors using the bold or italic headings when possible, otherwise by paragraphs that end with a period and are under 400 characters (headings are usually one sentence). Match old to new by similarity:
   ```python
   from difflib import SequenceMatcher

   def match(old: list[str], new: list[str], threshold=0.6):
       pairs, used = [], set()
       for o in old:
           best, score = None, 0.0
           for j, n in enumerate(new):
               if j in used:
                   continue
               s = SequenceMatcher(None, o.lower(), n.lower()).quick_ratio()
               if s > score:
                   best, score = j, s
           if best is not None and score >= threshold:
               used.add(best); pairs.append((o, new[best], score))
           else:
               pairs.append((o, None, score))
       added = [n for j, n in enumerate(new) if j not in used]
       return pairs, added
   ```
   Labels: **Added** (new only), **Removed** (old only), **Changed** (matched with ratio below 0.98), **Same**.

7. **Compare other sections by sentence.** Use `difflib.unified_diff` on sentence lists and keep only changed sentences with 1 sentence of context. Highlight changed numbers (percentages, dollar amounts) separately because they are easy to miss.

8. **Summarize with the model.** For each Added, Removed, and Changed unit, ask:
   ```
   Old text: {old or "none"}
   New text: {new or "none"}
   In one or two neutral sentences, describe what changed. Quote short phrases
   exactly. Do not speculate about why or about the stock.
   ```

9. **Write the report.**

## Output format

`sec-diff_<TICKER>_<oldperiod>_vs_<newperiod>.html` (self contained) and a `.md` version, containing:
- Header: company, CIK, the two filings with filing dates and EDGAR links.
- A short overview paragraph of the main changes.
- Per section: Added, Removed, and Changed items, each with the model's one line description and the exact text with insertions and deletions marked.
- Footer: "Not investment advice. Generated with the /sec-diff skill guide by IOTA - Joseph Bryant from public SEC filings."

## Safety and confirmation rules

- Ask for the User-Agent contact once; never invent one.
- Respect SEC fair access: a delay between requests, no parallel downloads, cache files locally.
- Confirm the two filings before downloading.
- Never overwrite saved filings or reports without asking.
- Never post, send, or share the report. Not investment advice.

## Quality checks

- Both filings are the same company and form type.
- Every summarized change shows the quoted source text so the user can check it.
- Sections that failed to split are reported, not silently skipped.
- Numbers quoted in summaries appear in the source text exactly.

## Examples

1. `/sec-diff MSFT`: latest two 10-K filings, Items 1A and 7. Report lists new risk factors, removed ones, and reworded paragraphs with exact text.
2. `/sec-diff AAPL 2023 2025 sections 1A`: risk factors only, two years apart.
3. Local mode: `/sec-diff old.htm new.htm` with files from a research folder, no network used.

## Troubleshooting

| Symptom | Fix |
|---|---|
| HTTP 403 from SEC | Missing or generic User-Agent. Set your name and email. |
| Item 1A not found | Some filings put risk factors in an exhibit or use unusual headings. The skill shows nearby headings and asks which to use. |
| Everything shows as Changed | The company reorganized the section. Lower the match threshold to 0.5 or compare by paragraph. |
| Smaller reporting company with no risk factors | Item 1A may say "not required". The skill reports that. |

## Limitations

- Section splitting is heuristic; unusual layouts can need manual help.
- Tables (including financial statements) are flattened to text and are not compared cell by cell.
- Model summaries can miss nuance; the quoted text is the source of truth.
- Not investment advice.

## Changelog

- 1.0 (October 2026): First release. EDGAR lookup and download with fair access, local file mode, risk factor matching, sentence diff, HTML and Markdown report.
