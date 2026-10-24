---
name: Work Instruction Writer
command: /work-instruction
version: "1.0"
category: Engineering
editions: both
editions_reason: "Works in both editions. The model drafts the steps locally and python-docx writes the document on your PC. Photos you add stay local."
network: offline
author: "IOTA - Joseph Bryant"
license: "Free to use, copy, and adapt with credit to IOTA - Joseph Bryant. Provided as is, without warranty."
homepage: https://iotallc.github.io/skills/
---

# /work-instruction: Work Instruction Writer

Created by IOTA - Joseph Bryant. https://iotallc.github.io/

This file is a skill guide. It tells the model in IOTA how to do the job step by step. It is not a compiled program and it does not install anything. To use it, paste its text into an IOTA chat and then give your request, or read it and follow the steps yourself.

## Purpose

Turn notes, a recorded explanation, or an old document into a clear, numbered work instruction: one action per step, key points and reasons, safety callouts placed before the step they apply to, required tools and PPE, photo placeholders, and a revision block with approval lines. Output is a DOCX your document control system can take.

## When to use

- Writing a new standard work instruction for a machine, assembly, or inspection.
- Rewriting a long paragraph style procedure into steps.
- Converting a transcript from /transcribe of someone explaining a job.

## When not to use

- Lockout and tagout procedures, confined space entry, or other regulated safety procedures, unless your safety team writes and approves the content. The skill can format such a document but must not invent its safety content.
- Chemical handling details that should come from the Safety Data Sheet. The skill references the SDS instead of guessing.

## Requirements

- Python 3.10 or later with `python-docx`.
- Model: Gemma 3 4B can restructure notes into steps. Gemma 3 12B or a Nemotron model writes clearer key points and catches missing steps more often.

## Inputs

| Input | Required | Example |
|---|---|---|
| Source notes | Yes | text, transcript, or old document |
| Title | Yes | "Change reamer on op 30" |
| Document number | No | `WI-030-04` |
| Revision | No | `A` (default for new) |
| Area or machine | No | "Cell 3, VMC-2" |
| Author, approver | No | names for the revision block |
| Hazards known | Strongly recommended | "rotating spindle, sharp tools, coolant" |

## Step-by-step procedure

1. **Extract facts** from the source: tools, materials, PPE, hazards, settings (numbers with units), quality checks, and the order of actions. List anything unclear as questions.

2. **Ask the open questions** before writing. Typical ones: "What torque?", "Which gauge?", "Is the machine powered off or in setup mode for this step?" Never fill numbers the source did not give; use `[CONFIRM: value]`.

3. **Write steps with this structure.** One action per step, starting with a verb. Each step has up to three parts:

   | Part | Content | Example |
   |---|---|---|
   | Step | What to do | "Loosen the tool holder with the 32 mm wrench." |
   | Key point | How to do it right | "Turn counterclockwise, hold the spindle with the lock." |
   | Reason | Why it matters | "Prevents spindle damage." |

   Prompt used per section:
   ```
   Rewrite these notes as work instruction steps. Rules:
   - One action per step, starting with a verb, under 20 words.
   - Add a key point only when there is a "how" that matters.
   - Add a reason only when it helps people follow the key point.
   - Keep every number and unit exactly as given. Mark missing values [CONFIRM].
   - Do not add safety rules that are not in the notes; list suggested
     hazards separately as "for safety review".
   Notes:
   {notes}
   ```

4. **Place safety callouts.** Callouts go immediately before the step they apply to, never after. Three levels, following the common ANSI Z535.6 style for product safety messages:

   | Level | Use | Format |
   |---|---|---|
   | DANGER | Will cause death or serious injury if not avoided | Red bar, bold |
   | WARNING | Could cause death or serious injury | Orange bar, bold |
   | CAUTION | Could cause minor or moderate injury | Yellow bar |
   | NOTICE | Equipment damage, no injury | Blue bar |

   Each callout says the hazard, the consequence, and how to avoid it: "WARNING: Rotating spindle. Can catch gloves and cause hand injury. Press E-stop and wait for the spindle to stop before reaching in."

   Hazards that the source mentions become callouts. Hazards the model thinks of but the source does not mention go into a "For safety review" list at the end and are NOT placed in the instruction until someone approves them.

5. **Add the header and lists.**
   - Title, document number, revision, area, page x of y.
   - Required PPE, tools, and materials as short lists.
   - Photo placeholders as `[PHOTO: tool holder in spindle, wrench on flats]`.

6. **Write the DOCX.**
   ```python
   from docx import Document
   from docx.enum.text import WD_ALIGN_PARAGRAPH
   from docx.oxml import OxmlElement
   from docx.oxml.ns import qn
   from docx.shared import Pt, RGBColor

   COLORS = {"DANGER": "C00000", "WARNING": "ED7D31", "CAUTION": "FFC000", "NOTICE": "2F5597"}

   def shade(cell, hex_color):
       tc_pr = cell._tc.get_or_add_tcPr()
       shd = OxmlElement("w:shd")
       shd.set(qn("w:val"), "clear"); shd.set(qn("w:color"), "auto"); shd.set(qn("w:fill"), hex_color)
       tc_pr.append(shd)

   def callout(doc, level, text):
       t = doc.add_table(rows=1, cols=2); t.style = "Table Grid"
       a, b = t.rows[0].cells
       shade(a, COLORS[level])
       run = a.paragraphs[0].add_run(level); run.bold = True
       run.font.color.rgb = RGBColor(0, 0, 0) if level == "CAUTION" else RGBColor(255, 255, 255)
       b.text = text
       doc.add_paragraph()

   def write_wi(meta, ppe, tools, steps, review, revisions, path):
       doc = Document()
       doc.styles["Normal"].font.size = Pt(11)
       doc.add_heading(meta["title"], 0)
       doc.add_paragraph(f"{meta['number']}   Rev {meta['rev']}   {meta['area']}")
       doc.add_heading("PPE", 2); [doc.add_paragraph(p, style="List Bullet") for p in ppe]
       doc.add_heading("Tools and materials", 2); [doc.add_paragraph(t, style="List Bullet") for t in tools]
       doc.add_heading("Steps", 1)
       for i, s in enumerate(steps, 1):
           for c in s.get("callouts", []):
               callout(doc, c["level"], c["text"])
           p = doc.add_paragraph(); r = p.add_run(f"{i}. {s['step']}"); r.bold = True
           if s.get("key"):
               doc.add_paragraph(f"Key point: {s['key']}")
           if s.get("reason"):
               doc.add_paragraph(f"Reason: {s['reason']}")
           if s.get("photo"):
               doc.add_paragraph(f"[PHOTO: {s['photo']}]")
       if review:
           doc.add_heading("For safety review (not part of the approved instruction)", 2)
           [doc.add_paragraph(x, style="List Bullet") for x in review]
       doc.add_heading("Revision history", 1)
       t = doc.add_table(rows=1, cols=5); t.style = "Table Grid"
       for c, h in zip(t.rows[0].cells, ["Rev", "Date", "Change", "Author", "Approved"]):
           c.text = h
       for rev in revisions:
           cells = t.add_row().cells
           for c, v in zip(cells, rev):
               c.text = v
       foot = doc.sections[0].footer.paragraphs[0]
       foot.text = f"{meta['number']} Rev {meta['rev']}. Uncontrolled when printed. Drafted with the /work-instruction skill guide by IOTA - Joseph Bryant."
       foot.alignment = WD_ALIGN_PARAGRAPH.CENTER
       doc.save(path)
   ```

7. **Revision block rules.** New documents start at Rev A with "Initial release". For a revision, the skill compares old and new steps and writes a one line change summary per change, for example "Step 6: torque changed from 40 to 45 N m". Approval cells are left blank for signatures.

8. **Read back.** Show the steps in chat as a numbered list with callouts, plus the open `[CONFIRM]` items and the safety review list.

## Output format

- `WI-<number>-Rev<rev>.docx`
- A chat summary: step count, open confirmations, safety review items.

## Safety and confirmation rules

- Never invent safety content. Suggested hazards go to a review list, clearly labeled.
- Never invent numbers (torque, temperature, pressure). Use `[CONFIRM]`.
- Never overwrite an existing revision; a change creates the next revision file.
- The document is marked "Uncontrolled when printed" and leaves approval blank.
- Nothing is published to a document system by the skill.

## Quality checks

- Every step starts with a verb and has one action.
- Every callout comes before its step.
- Every number from the source appears unchanged.
- PPE in the header matches PPE mentioned in steps.
- No `[CONFIRM]` remains when the user says the document is final; if some remain, the skill lists them.

## Examples

1. **Reamer change:** 11 steps, WARNING before reaching into the spindle, CAUTION for sharp edges, NOTICE for tool length offset, two `[CONFIRM]` torque values.
2. **Transcript input:** a 6 minute /transcribe text of a lead explaining a leak test becomes 14 steps with three photo placeholders.
3. **Revision:** Rev B of a packing instruction with the change summary "Step 4: label position moved to the short side".

## Troubleshooting

| Symptom | Fix |
|---|---|
| Steps too long | Ask the skill to split steps over 20 words. |
| Callout colors do not show | Some viewers ignore cell shading; open in Word or LibreOffice. |
| `List Bullet` style missing | The default python-docx template has it; custom templates may not. Use the default or add the style. |

## Limitations

- The skill does not take or edit photos; it only adds placeholders.
- Safety content needs a qualified reviewer.
- Formatting is a clean default, not your company template. You can pass a template DOCX to `Document(path)` to use your styles.

## Changelog

- 1.0 (October 2026): First release. Step, key point, reason structure, safety callouts placed before steps, revision block, DOCX.
