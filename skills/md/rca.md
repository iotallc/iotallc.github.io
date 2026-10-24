---
name: Root Cause Analysis and 8D
command: /rca
version: "1.0"
category: Engineering
editions: both
editions_reason: "Works in both editions. The guided questions run in chat with the local model, the fishbone is drawn with matplotlib, and the report is written with python-docx or reportlab on your PC."
network: offline
author: "IOTA - Joseph Bryant"
license: "Free to use, copy, and adapt with credit to IOTA - Joseph Bryant. Provided as is, without warranty."
homepage: https://iotallc.github.io/skills/
---

# /rca: Root Cause Analysis and 8D

Created by IOTA - Joseph Bryant. https://iotallc.github.io/

This file is a skill guide. It tells the model in IOTA how to do the job step by step. It is not a compiled program and it does not install anything. To use it, paste its text into an IOTA chat and then give your request, or read it and follow the steps yourself.

## Purpose

Walk a problem from first report to a closed 8D: define the problem clearly, contain it, find causes with 5 Whys and a fishbone (Ishikawa) diagram, choose and verify corrective actions, and write the 8D report as DOCX or PDF. The skill asks the questions; you and your team supply the facts.

## When to use

- A customer complaint, internal escape, or repeat defect needs a documented root cause.
- You want a structured 5 Whys instead of a free discussion.
- A supplier or customer asked for an 8D.

## When not to use

- Injuries or safety incidents that need a formal investigation under your company's or regulator's procedure. The skill can help organize notes but is not that procedure.
- When facts are not available yet. The skill will keep asking for data instead of guessing.

## Requirements

- Python 3.10 or later with `matplotlib`, and `python-docx` for DOCX or `reportlab` for PDF.
- Model: Gemma 3 12B or 27B or a Nemotron model asks better follow up questions. Gemma 3 4B can run the templates but tends to accept the first plausible cause; the "evidence" rule below matters more with small models.

## Inputs

| Input | Required | Example |
|---|---|---|
| Problem report | Yes | "Customer found 12 brackets with bore oversize, lot 2410-07" |
| Data | Strongly recommended | measurements, photos, dates, lot numbers |
| Team members | No | names and roles for D1 |
| Report format | No | `docx` (default) or `pdf` |
| Report number | No | `8D-2026-014` |

## Step-by-step procedure

1. **D1 Team.** Record names and roles. If the user is alone, record that and suggest who should review.

2. **D2 Problem description with 5W2H.** Ask each until answered or marked unknown:

   | Question | Example answer |
   |---|---|
   | What is the defect? | Bore 10.03 to 10.05 mm, spec 10.000 to 10.015 |
   | Where was it found? | Customer incoming inspection |
   | When? | October 14, lot 2410-07 |
   | Who found it? | Customer QA |
   | Which parts? | B-200 bracket, rev C |
   | How many? | 12 of 400 checked |
   | How was it detected? | Pin gauge |

   Then write a one sentence problem statement with no cause in it. Wrong: "Worn reamer caused oversize." Right: "12 of 400 B-200 brackets from lot 2410-07 had bore diameter 10.03 to 10.05 mm against a 10.015 mm maximum."

3. **D3 Containment.** Ask what has been done to protect the customer now: sort stock, quarantine, 100 percent check. Record quantity checked, quantity rejected, and date. Containment is not the fix.

4. **D4 Root cause.**

   *Fishbone first.* Brainstorm possible causes under the six M categories: Man (people), Machine, Method, Material, Measurement, Mother Nature (environment). Draw it:
   ```python
   import matplotlib
   matplotlib.use("Agg")
   import matplotlib.pyplot as plt

   def fishbone(problem: str, causes: dict[str, list[str]], path: str):
       cats = list(causes)
       fig, ax = plt.subplots(figsize=(13, 6.5))
       ax.set_xlim(0, 13); ax.set_ylim(0, 6.5); ax.axis("off")
       ax.annotate("", xy=(10.6, 3.25), xytext=(0.5, 3.25),
                   arrowprops=dict(arrowstyle="-|>", lw=2, color="#333"))
       ax.text(10.7, 3.25, problem, va="center", ha="left", fontsize=11, wrap=True,
               bbox=dict(boxstyle="round", fc="#F2F2F2", ec="#333"))
       xs = [2.5, 5.5, 8.5]
       for i, cat in enumerate(cats[:6]):
           top = i % 2 == 0
           x = xs[i // 2]
           y_end = 5.9 if top else 0.6
           ax.plot([x - 1.2, x], [y_end, 3.25], color="#333", lw=1.5)
           ax.text(x - 1.2, y_end + (0.2 if top else -0.3), cat, ha="center", fontsize=11, weight="bold")
           for j, c in enumerate(causes[cat][:4]):
               t = (j + 1) / 5
               cx = x - 1.2 + 1.2 * t
               cy = y_end + (3.25 - y_end) * t
               ax.plot([cx - 0.9, cx], [cy, cy], color="#777", lw=1)
               ax.text(cx - 0.95, cy, c, ha="right", va="center", fontsize=8.5)
       fig.tight_layout(); fig.savefig(path, dpi=150); plt.close(fig)
   ```

   *Then narrow.* For each fishbone cause, ask: "What evidence supports or rules this out?" Mark each cause as Confirmed, Ruled out, or Not checked. Only confirmed or likely causes go to 5 Whys.

   *5 Whys.* Ask "why" for each surviving cause, one level at a time. At every level require a fact, not an opinion:
   ```
   Why {n}: Why did "{previous answer}" happen?
   Answer with what is known. Then say what evidence shows it
   (measurement, record, photo, test). If there is no evidence yet,
   say "needs check" and suggest how to check it.
   ```
   Stop when the answer is a process or system cause that the team can change (a missing control, an unclear standard, a design gap). Do the chain twice: once for why it **occurred** and once for why it **escaped** (was not detected).

   Example chain:
   ```
   Occurred
   1. Bore oversize            -> reamer cut large (CMM shows 10.04 on parts)
   2. Reamer cut large         -> reamer worn (tool shows edge wear at 1,900 parts)
   3. Reamer worn              -> used past 1,200 part life
   4. Used past life           -> no tool life counter on op 30
   5. No counter               -> tool life not set in the machine setup standard
   Escaped
   1. Not caught at op 30      -> gauge check every 10 parts used a worn go pin
   2. Worn go pin              -> gauge not in calibration system
   ```

5. **D5 Choose corrective actions.** One action per root cause (occurred and escaped). Prefer error proofing over training or reminders. State how each will be verified.

6. **D6 Implement and verify.** Record what was done, when, and the result data. Example: "Tool life counter set to 1,000 parts on Oct 18; 600 parts since, bore 10.004 to 10.011."

7. **D7 Prevent recurrence.** Update standards: setup sheet, PFMEA (link to /fmea), control plan, work instruction (link to /work-instruction), and similar machines.

8. **D8 Close and recognize the team.**

9. **Write the report.**
   ```python
   from docx import Document
   from docx.shared import Inches, Pt

   def write_8d(data: dict, fishbone_png: str, path: str):
       doc = Document()
       doc.styles["Normal"].font.size = Pt(10.5)
       doc.add_heading(f"8D Report {data['number']}", 0)
       doc.add_paragraph(f"Part: {data['part']}    Customer: {data['customer']}    Opened: {data['opened']}")
       sections = [
           ("D1 Team", data["team"]), ("D2 Problem description", data["problem"]),
           ("D3 Containment", data["containment"]), ("D4 Root cause", data["root_cause"]),
           ("D5 Corrective actions", data["actions"]), ("D6 Implementation and verification", data["verification"]),
           ("D7 Prevent recurrence", data["prevention"]), ("D8 Closure", data["closure"]),
       ]
       for title, body in sections:
           doc.add_heading(title, level=1)
           for para in body if isinstance(body, list) else [body]:
               doc.add_paragraph(para)
           if title.startswith("D4"):
               doc.add_picture(fishbone_png, width=Inches(6.5))
               for chain_name, chain in data["whys"].items():
                   doc.add_paragraph(chain_name, style="Heading 3")
                   t = doc.add_table(rows=1, cols=3); t.style = "Light Grid Accent 1"
                   t.rows[0].cells[0].text, t.rows[0].cells[1].text, t.rows[0].cells[2].text = "Why", "Answer", "Evidence"
                   for i, (ans, ev) in enumerate(chain, 1):
                       r = t.add_row().cells; r[0].text, r[1].text, r[2].text = str(i), ans, ev
       doc.add_paragraph("Prepared with the /rca skill guide by IOTA - Joseph Bryant. Content reviewed by the team listed in D1.")
       doc.save(path)
   ```
   For PDF, build the same sections with `reportlab.platypus` (`SimpleDocTemplate`, `Paragraph`, `Table`, `Image`), or convert the DOCX with LibreOffice if it is installed: `soffice --headless --convert-to pdf report.docx`.

## Output format

- `8D-<number>.docx` or `.pdf`
- `fishbone.png`
- A chat summary: problem statement, root causes (occurred and escaped), actions, and open items.

## Safety and confirmation rules

- Never write a cause into the report as confirmed without evidence the user provided. Unverified items are labeled "needs check".
- Do not name or blame individuals; record system causes.
- Never overwrite an existing report; create a new revision file.
- Nothing is sent to customers or suppliers. The user sends the report.

## Quality checks

- The problem statement contains no cause.
- Each root cause has an action, and each action has a verification with data.
- Both the occurrence and escape chains are present.
- D3 containment quantities add up (checked = accepted + rejected).

## Examples

1. **Oversize bore:** chains above; actions: tool life counter and gauge calibration; DOCX with fishbone.
2. **Label mix up at packing:** occurred root cause "two part numbers share one print template"; escaped root cause "no scan verification"; action: barcode scan at pack out.
3. **Incomplete data:** the user has no measurements yet. The skill stops at D4 with a list of checks to run and saves a draft marked "open".

## Troubleshooting

| Symptom | Fix |
|---|---|
| 5 Whys ends at "operator error" | Ask why the process allowed the error. Keep going. |
| Too many fishbone causes | Vote on the top three with evidence, mark the rest "not checked". |
| `Light Grid Accent 1` style missing | Use `Table Grid`, which exists in every default template. |
| PDF conversion fails | Install LibreOffice or use the reportlab path. |

## Limitations

- The quality of the analysis depends on the facts supplied; the model does not see your parts.
- One problem per 8D.
- The fishbone drawing fits up to six categories and four causes each; longer lists go in a table.

## Changelog

- 1.0 (October 2026): First release. 5W2H, fishbone, evidence based 5 Whys (occurred and escaped), 8D DOCX and PDF.
