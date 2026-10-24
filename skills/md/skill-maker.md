---
name: Skill Maker
command: /skill-maker
version: "1.0"
category: IOTA tools
editions: both
editions_reason: "Works in both editions. It writes a skill guide, a helper script, and tests into a staging folder on your PC and runs the tests locally. Nothing is downloaded or published."
network: offline
author: "IOTA - Joseph Bryant"
license: "Free to use, copy, and adapt with credit to IOTA - Joseph Bryant. Provided as is, without warranty."
homepage: https://iotallc.github.io/skills/
---

# /skill-maker: Skill Maker

Created by IOTA - Joseph Bryant. https://iotallc.github.io/

This file is a skill guide. It tells the model in IOTA how to do the job step by step. It is not a compiled program and it does not install anything. To use it, paste its text into an IOTA chat and then give your request, or read it and follow the steps yourself.

## Purpose

Create a new skill from a plain description: a skill guide `.md` in the same format as this one, an optional helper script, and tests for that script. Everything is written to a staging folder first. The skill is copied into your skills folder only after the tests pass and you say yes.

## When to use

- You repeat the same multi step task and want IOTA to follow the same steps every time.
- You have a script and want a guide that tells the model when and how to run it.
- You want to adapt one of the published guides to your own shop or team.

## When not to use

- One time tasks. Just ask directly.
- Tasks that need tools you do not have installed. The skill will list what is missing rather than write code that cannot run.

## Requirements

- Python 3.10 or later with `pytest` for script based skills, or Pester 5 for PowerShell scripts.
- Model: Gemma 3 12B or 27B or a Nemotron model writes better procedures and code. Gemma 3 4B can fill the template for simple skills; review its code carefully.

## Inputs

| Input | Required | Example |
|---|---|---|
| Description | Yes | "Rename scanned PDFs using the invoice number on page 1" |
| Command name | No | `/rename-invoices` (default derived from the description) |
| Script language | No | `python` (default), `powershell`, or `none` |
| Category | No | Building apps, Engineering, Finance, IOTA tools, Everyday |
| Skills folder | No | your configured skills folder |

## Step-by-step procedure

1. **Interview.** Ask up to five short questions, one at a time, only where the description is unclear:
   - What goes in (files, text, folders)?
   - What comes out (file type, location, naming)?
   - What must never happen (overwrite, delete, send)?
   - What does a correct result look like for one example?
   - Does it need the internet?

2. **Check the name.** The command must be lowercase letters, digits, and hyphens, start with a letter, and not collide with an existing skill in the skills folder. If it collides, suggest `-2` or a better name.

3. **Write the guide** to `staging/<name>/<name>.md` using this template:
   ```markdown
   ---
   name: <Title Case Name>
   command: /<name>
   version: "1.0"
   category: <category>
   editions: <both | powershell | exe>
   editions_reason: "<one honest sentence>"
   network: <offline | online>
   author: "<your name>"
   based_on: "Skill Maker by IOTA - Joseph Bryant"
   license: "<your license note>"
   ---

   # /<name>: <Title>

   ## Purpose
   ## When to use
   ## When not to use
   ## Requirements
   ## Inputs
   ## Step-by-step procedure
   ## Output format
   ## Safety and confirmation rules
   ## Quality checks
   ## Examples
   ## Troubleshooting
   ## Limitations
   ## Changelog
   ```
   Rules for the content:
   - Steps are numbered and each one is something the model can actually do.
   - Every destructive action (overwrite, delete, move, send) has an explicit "ask first" line.
   - Requirements state honestly what model size works.
   - The guide credits its author. When built with this skill, it also keeps the `based_on` line.

4. **Write the helper script** (if any) to `staging/<name>/<name_with_underscores>.py` (hyphens become underscores so tests can import it) with a `main(argv)` function, `argparse`, dry run as the default for anything that changes files (an `--apply` flag makes the changes), and pure functions for the logic so they can be tested. Example for the invoice renamer:
   ```python
   import argparse
   import re
   from pathlib import Path

   INVOICE = re.compile(r"Invoice\s*(?:No\.?|Number|#)\s*[:#]?\s*([A-Z0-9-]{4,20})", re.I)

   def invoice_number(text: str) -> str | None:
       m = INVOICE.search(text)
       return m.group(1).upper() if m else None

   def plan(folder: Path, read_text) -> list[tuple[Path, Path]]:
       moves, taken = [], set()
       for pdf in sorted(folder.glob("*.pdf")):
           num = invoice_number(read_text(pdf))
           if not num:
               continue
           target = pdf.with_name(f"INV_{num}.pdf")
           i = 2
           while target.exists() or target in taken:
               target = pdf.with_name(f"INV_{num}_{i}.pdf"); i += 1
           taken.add(target)
           if target != pdf:
               moves.append((pdf, target))
       return moves

   def first_page_text(pdf: Path) -> str:
       from pypdf import PdfReader
       return PdfReader(pdf).pages[0].extract_text() or ""

   def main(argv=None) -> int:
       ap = argparse.ArgumentParser()
       ap.add_argument("folder", type=Path)
       ap.add_argument("--apply", action="store_true", help="rename files (default is a dry run)")
       a = ap.parse_args(argv)
       moves = plan(a.folder, first_page_text)
       for src, dst in moves:
           print(f"{'RENAME' if a.apply else 'WOULD RENAME'} {src.name} -> {dst.name}")
           if a.apply:
               src.rename(dst)
       return 0

   if __name__ == "__main__":
       raise SystemExit(main())
   ```

5. **Write tests** to `staging/<name>/test_<name_with_underscores>.py`. Test the pure logic with fake inputs and a temporary folder; never test against real user files.
   ```python
   from pathlib import Path
   import rename_invoices as ri

   def test_invoice_number_variants():
       assert ri.invoice_number("Invoice No. ab-1234") == "AB-1234"
       assert ri.invoice_number("INVOICE # 99881") == "99881"
       assert ri.invoice_number("Receipt") is None

   def test_plan_avoids_collisions(tmp_path: Path):
       for n in ("a.pdf", "b.pdf"):
           (tmp_path / n).write_bytes(b"")
       moves = ri.plan(tmp_path, lambda p: "Invoice Number: 1001")
       assert [d.name for _, d in moves] == ["INV_1001.pdf", "INV_1001_2.pdf"]

   def test_dry_run_changes_nothing(tmp_path: Path, monkeypatch):
       (tmp_path / "a.pdf").write_bytes(b"")
       monkeypatch.setattr(ri, "first_page_text", lambda p: "Invoice # 7777")
       ri.main([str(tmp_path)])
       assert (tmp_path / "a.pdf").exists()
   ```
   The file name in the test import must match the script name with hyphens replaced by underscores; the skill names the script file accordingly (`rename_invoices.py`).

6. **Run the tests** in the staging folder: `python -m pytest -q staging/<name>`. Use the /fix-build loop (max 5 rounds) if they fail. Do not continue to install with failing tests.

7. **Lint the guide.** Check that the frontmatter parses, the command matches the file name, all sections exist in order, and the safety section mentions every destructive action used in the script.
   ```python
   import re, yaml
   REQUIRED = ["Purpose", "When to use", "When not to use", "Requirements", "Inputs",
               "Step-by-step procedure", "Output format", "Safety and confirmation rules",
               "Quality checks", "Examples", "Troubleshooting", "Limitations", "Changelog"]

   def lint(md: str) -> list[str]:
       errs = []
       m = re.match(r"^---\n(.*?)\n---\n", md, re.S)
       if not m:
           return ["missing frontmatter"]
       meta = yaml.safe_load(m.group(1))
       for k in ("name", "command", "version", "category", "editions", "network", "author"):
           if k not in meta:
               errs.append(f"frontmatter missing {k}")
       heads = re.findall(r"^## (.+)$", md, re.M)
       pos = [heads.index(h) if h in heads else -1 for h in REQUIRED]
       errs += [f"missing section {h}" for h, p in zip(REQUIRED, pos) if p < 0]
       found = [p for p in pos if p >= 0]
       if found != sorted(found):
           errs.append("sections out of order")
       return errs
   ```
   If PyYAML is not installed, the skill parses the simple `key: value` lines itself.

8. **Show and ask.** Show the guide, the script, and the test result. Ask: "Install /<name> into your skills folder?" Only on yes, copy the staging folder. If a skill with that name exists there, ask again before replacing it and keep a backup copy as `<name>.bak-<date>`.

## Output format

```
staging/rename-invoices/
  rename-invoices.md
  rename_invoices.py
  test_rename_invoices.py
pytest: 3 passed
```

## Safety and confirmation rules

- Nothing is installed without an explicit yes after the tests pass.
- Generated scripts default to dry run for anything that changes files.
- Never overwrite an existing skill without a second confirmation and a backup.
- Generated code must not read credentials, send network requests, or delete files unless the user asked for that in the interview, and then the guide must say so in its safety section.
- Nothing is published or shared.

## Quality checks

- Tests pass and cover the main logic plus the dry run.
- The guide lint returns no errors.
- The example in the guide matches what the script actually prints.

## Examples

1. "Rename scanned invoices": the example above, 3 tests passing, installed after yes.
2. "A guide for our weekly scrap report, no script": a guide only, with steps that call /chart and /fin.
3. "Adapt /work-instruction to our template": a copy with a new name, `based_on` credit, and the company template path as an input.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `ModuleNotFoundError` in tests | Run pytest from the staging folder or add `conftest.py` that puts it on `sys.path`. |
| pypdf missing | Install it, or let the script take text from /ocr output. |
| Name collision | Pick another name; the skill never replaces silently. |

## Limitations

- Generated code is only as good as the tests; review before using on important files.
- The skill does not package skills for sharing; zip the folder yourself if you want to share it.

## Changelog

- 1.0 (October 2026): First release. Interview, guide template, helper script with dry run, tests, lint, confirmed install.
