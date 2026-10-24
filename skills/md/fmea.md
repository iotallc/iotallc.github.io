---
name: FMEA Builder
command: /fmea
version: "1.0"
category: Engineering
editions: both
editions_reason: "Works in both editions. The model helps draft failure modes from your description, and local Python computes RPN and writes the spreadsheet. Nothing is uploaded."
network: offline
author: "IOTA - Joseph Bryant"
license: "Free to use, copy, and adapt with credit to IOTA - Joseph Bryant. Provided as is, without warranty."
homepage: https://iotallc.github.io/skills/
---

# /fmea: FMEA Builder

Created by IOTA - Joseph Bryant. https://iotallc.github.io/

This file is a skill guide. It tells the model in IOTA how to do the job step by step. It is not a compiled program and it does not install anything. To use it, paste its text into an IOTA chat and then give your request, or read it and follow the steps yourself.

## Purpose

Build a process or design FMEA (failure mode and effects analysis) with you: list the steps or functions, draft failure modes, effects, and causes, rate Severity, Occurrence, and Detection from 1 to 10, compute RPN, sort by risk, propose actions, and export a formatted XLSX that your team can keep editing.

## When to use

- Preparing a PFMEA for a new or changed process step.
- A DFMEA for a part or assembly.
- Refreshing an old FMEA after a quality escape.

## When not to use

- As a replacement for the cross functional team. The skill drafts; the team decides ratings.
- When your customer requires the AIAG and VDA 2019 Action Priority (AP) method only. The skill can add an AP column (see step 6), but check your customer's manual.
- Safety critical sign off. Final ratings and actions need human review and approval.

## Requirements

- Python 3.10 or later with `openpyxl`.
- Model: Gemma 3 12B or a Nemotron model of similar size drafts better failure modes and causes. Gemma 3 4B works if you supply the process steps and review each row; it tends to repeat generic causes.

## Inputs

| Input | Required | Example |
|---|---|---|
| Type | Yes | `process` or `design` |
| Scope | Yes | "Drill and ream bore on bracket B-200, op 30" |
| Steps or functions | Yes, or let the skill propose | "Load part, clamp, drill 9.8 mm, ream 10 mm H7, unload" |
| Existing controls | No | "Go/no-go gauge every 10 parts" |
| Rating scale | No | Default scales below, or your company's |
| Action threshold | No | RPN 100 or Severity 9 to 10 (default) |

## Step-by-step procedure

1. **Confirm the scope** in one sentence and list the steps. If the user did not give steps, propose them and ask for a yes.

2. **Draft rows step by step.** For each step, ask the model:
   ```
   Process step: {step}
   Scope: {scope}
   List up to 4 realistic failure modes for this step. For each give:
   failure mode, effect on the customer or next operation, one or two
   root causes, current prevention control, current detection control.
   Use short technical phrases. Do not invent controls the user did not
   mention; write "none stated" instead. Answer as JSON rows.
   ```
   Show the draft rows per step and let the user edit, delete, or add before rating.

3. **Rate with clear scales.** Show the scale and suggest a rating with a one line reason; the user confirms or changes it.

   | Rating | Severity (effect) | Occurrence (likelihood) | Detection (ability to catch) |
   |---|---|---|---|
   | 10 | Safety or regulatory failure without warning | Very high, failure almost certain | No detection, cannot detect |
   | 9 | Safety or regulatory failure with warning | | Very remote chance of detection |
   | 8 | Loss of primary function | High | Remote |
   | 7 | Degraded primary function | | Very low |
   | 6 | Loss of secondary function | Moderate | Low |
   | 5 | Degraded secondary function | | Moderate |
   | 4 | Noticed by most customers | Low | Moderately high |
   | 3 | Noticed by some customers | | High |
   | 2 | Noticed by discerning customers | Remote | Very high |
   | 1 | No effect | Failure eliminated by prevention | Almost certain detection, error proofed |

   Rules the skill follows:
   - Severity belongs to the effect, so the same effect gets the same S everywhere.
   - Occurrence is lowered only by prevention controls; Detection only by detection controls.
   - If the user has data (scrap rate, ppm), use it for Occurrence and show the mapping.

4. **Compute RPN and flags.**
   ```python
   from dataclasses import dataclass, field

   @dataclass
   class Row:
       step: str
       mode: str
       effect: str
       cause: str
       prevention: str
       detection: str
       s: int
       o: int
       d: int
       action: str = ""
       owner: str = ""
       due: str = ""
       rpn: int = field(init=False)

       def __post_init__(self):
           for name in ("s", "o", "d"):
               v = getattr(self, name)
               if not isinstance(v, int) or not 1 <= v <= 10:
                   raise ValueError(f"{name.upper()} must be a whole number 1 to 10, got {v!r}")
           self.rpn = self.s * self.o * self.d

   def needs_action(r: Row, rpn_limit: int = 100) -> bool:
       return r.s >= 9 or r.rpn >= rpn_limit
   ```
   High severity is flagged regardless of RPN, because a low O and D can hide a dangerous effect.

5. **Propose actions** for flagged rows. Prefer prevention (error proofing, design change) over more inspection. The prompt includes: "Suggest one prevention action and one detection action. Say which rating each would lower and to what, with a reason." Leave owner and due date blank for the user.

6. **Optional Action Priority.** If asked, add an AP column (High, Medium, Low). The skill uses the AP table from the user's own copy of the AIAG and VDA handbook if they provide it, because that table is copyrighted and not reproduced here. Without it, the skill omits AP and says why.

7. **Export XLSX.**
   ```python
   from openpyxl import Workbook
   from openpyxl.styles import Alignment, Font, PatternFill
   from openpyxl.formatting.rule import CellIsRule
   from openpyxl.utils import get_column_letter

   HEAD = ["Step", "Failure mode", "Effect", "S", "Cause", "Prevention control", "O",
           "Detection control", "D", "RPN", "Recommended action", "Owner", "Due",
           "New S", "New O", "New D", "New RPN"]

   SCALES = [
       (10, "Safety or regulatory failure without warning", "Very high", "Cannot detect"),
       (9, "Safety or regulatory failure with warning", "", "Very remote"),
       # ... rows 8 to 2 as in the table above ...
       (1, "No effect", "Eliminated by prevention", "Almost certain, error proofed"),
   ]

   def export(rows, path, title, rpn_limit=100):
       wb = Workbook(); ws = wb.active; ws.title = "FMEA"
       ws.append([title]); ws["A1"].font = Font(bold=True, size=14)
       ws.append(["Generated with the /fmea skill guide by IOTA - Joseph Bryant. Ratings require team review."])
       ws.append(HEAD)
       for c in ws[3]:
           c.font = Font(bold=True, color="FFFFFF")
           c.fill = PatternFill("solid", fgColor="2A2A2A")
           c.alignment = Alignment(wrap_text=True, vertical="center")
       for r in sorted(rows, key=lambda r: (-r.s * (r.s >= 9), -r.rpn)):
           ws.append([r.step, r.mode, r.effect, r.s, r.cause, r.prevention, r.o,
                      r.detection, r.d, None, r.action, r.owner, r.due, None, None, None, None])
           i = ws.max_row
           ws[f"J{i}"] = f"=D{i}*G{i}*I{i}"
           ws[f"Q{i}"] = f'=IF(COUNT(N{i}:P{i})=3,N{i}*O{i}*P{i},"")'
       last = ws.max_row
       red = PatternFill("solid", fgColor="F4C7C3")
       ws.conditional_formatting.add(f"J4:J{last}", CellIsRule(operator="greaterThanOrEqual", formula=[str(rpn_limit)], fill=red))
       ws.conditional_formatting.add(f"D4:D{last}", CellIsRule(operator="greaterThanOrEqual", formula=["9"], fill=red))
       widths = [18, 26, 26, 5, 26, 22, 5, 22, 5, 7, 30, 12, 11, 7, 7, 7, 9]
       for i, w in enumerate(widths, start=1):
           ws.column_dimensions[get_column_letter(i)].width = w
       for row in ws.iter_rows(min_row=4):
           for c in row:
               c.alignment = Alignment(wrap_text=True, vertical="top")
       ws.freeze_panes = "B4"
       ws.auto_filter.ref = f"A3:Q{last}"
       scales = wb.create_sheet("Scales")
       scales.append(["Rating", "Severity", "Occurrence", "Detection"])
       for line in SCALES:   # list of (rating, severity, occurrence, detection) from step 3
           scales.append(list(line))
       wb.save(path)
   ```
   RPN is a live formula so the team can change ratings in Excel. The Scales sheet holds the table from step 3.

8. **Summarize.** Top five risks, count of flagged rows, and the rows where only detection controls exist.

## Output format

- `FMEA_<scope>_<date>.xlsx` with sheets FMEA and Scales.
- A chat table of the top risks.

## Safety and confirmation rules

- Ratings are suggestions until the user confirms each one.
- Never overwrite an existing FMEA file; write a new dated file and offer to compare.
- The export states that ratings require team review.
- Nothing is sent or shared.

## Quality checks

- Every row has S, O, D between 1 and 10 and an RPN equal to S times O times D.
- The same effect has the same Severity across rows; the skill lists any mismatch.
- No action row is left without a target rating that is lower than the current one.
- Controls not stated by the user are written as "none stated", never invented.

## Examples

1. **Ream bore op 30:** "Oversize bore" with effect "loose fit, assembly rattle", S 7, cause "worn reamer", O 5, detection "go/no-go every 10 parts", D 4, RPN 140. Flagged. Action: tool life counter with forced change (lowers O to 2).
2. **DFMEA bracket:** "Crack at weld toe", S 9. Flagged on severity even though RPN is 54.
3. **Refresh:** user pastes 30 old rows; the skill finds 4 inconsistent severities and 6 rows with D 2 but no stated detection control.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Generic causes like "operator error" | Ask "why would the operator make that error?" and record the system cause. |
| RPN not updating in Excel | Calculation set to manual; press F9 or set to automatic. |
| Ratings drift between sessions | Keep your company scale in the Scales sheet and give it back to the skill next time. |

## Limitations

- RPN has known weaknesses (different S, O, D combinations give the same number). That is why severity is flagged separately.
- The skill does not reproduce copyrighted handbook tables.
- Drafts depend on the detail you give; the model does not know your shop floor.

## Changelog

- 1.0 (October 2026): First release. Guided drafting, rating scales, RPN and severity flags, XLSX with live formulas.
