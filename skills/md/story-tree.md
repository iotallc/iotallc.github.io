---
name: Story Tree Builder
command: /story-tree
version: "1.0"
category: IOTA tools
editions: both
editions_reason: "Works in both editions. The local model writes the scenes, Python validates the tree, and Graphviz or Mermaid draws the map on your PC."
network: offline
author: "IOTA - Joseph Bryant"
license: "Free to use, copy, and adapt with credit to IOTA - Joseph Bryant. Provided as is, without warranty."
homepage: https://iotallc.github.io/skills/
---

# /story-tree: Story Tree Builder

Created by IOTA - Joseph Bryant. https://iotallc.github.io/

This file is a skill guide. It tells the model in IOTA how to do the job step by step. It is not a compiled program and it does not install anything. To use it, paste its text into an IOTA chat and then give your request, or read it and follow the steps yourself.

## Purpose

Plan and write branching dialogue: scenes, characters, choices, and endings stored as a JSON file a game or interactive story can load, plus a visual map of every branch. The skill keeps the tree valid (no dead links, every path reaches an ending) and keeps content safe for work.

## When to use

- Writing a choose your own path story, a game conversation, or a training scenario with choices.
- Mapping an existing story to find dead ends and loose threads.
- Producing dialogue data for a game engine.

## When not to use

- Linear stories with no choices.
- Adult or graphic content. This skill only writes content suitable for all audiences (see the content rules).

## Requirements

- Python 3.10 or later. Graphviz (`dot`) for PNG and SVG maps, or none if you only need the Mermaid map.
- Model: Gemma 3 12B or 27B or a Nemotron model keeps characters and tone consistent across many scenes. Gemma 3 4B can write short trees (under 20 scenes) if each scene is generated with the summary of its path.

## Inputs

| Input | Required | Example |
|---|---|---|
| Premise | Yes | "A night shift engineer finds the factory robot talking to itself" |
| Audience | No | all ages (default) or teen |
| Size | No | about 15 scenes, 3 endings (default) |
| Characters | No | names, roles, voice notes |
| Style | No | short lines, present tense |
| Existing JSON | For edit or map mode | `story.json` |

## Content rules (SFW)

The skill applies these to every scene and choice and refuses requests outside them:
- No sexual content, nudity, or romantic content involving minors.
- No graphic violence or gore. Danger and conflict are fine when described without graphic detail.
- No hate speech or slurs, and no content that demeans people for who they are.
- No instructions for real world harm (weapons, drugs, hacking).
- No real living people as characters without the user confirming it is respectful and fictional.
- Self harm is never presented as a choice.
If a request breaks a rule, the skill says which rule and offers an alternative direction.

## Data format

```json
{
  "title": "Night Shift",
  "version": 1,
  "credit": "Built with the /story-tree skill guide by IOTA - Joseph Bryant",
  "start": "s1",
  "characters": {
    "mara": {"name": "Mara", "role": "night shift engineer"},
    "unit7": {"name": "Unit 7", "role": "assembly robot"}
  },
  "variables": {"trust": 0},
  "scenes": {
    "s1": {
      "text": "The line is silent. Then Unit 7 speaks: \"Are you the one who fixes things?\"",
      "speaker": "unit7",
      "choices": [
        {"label": "Answer it", "next": "s2", "effects": {"trust": 1}},
        {"label": "Call the supervisor", "next": "s3"}
      ]
    },
    "s2": {"text": "...", "choices": [{"label": "...", "next": "e1", "requires": {"trust": 1}}]},
    "s3": {"text": "...", "choices": [{"label": "...", "next": "e2"}]},
    "e1": {"text": "...", "ending": "good"},
    "e2": {"text": "...", "ending": "neutral"}
  }
}
```
Rules: scene ids are short strings; a scene has either `choices` (1 to 4) or `ending`; `effects` add numbers to variables; `requires` hides a choice unless each variable is at least the given value.

## Step-by-step procedure

1. **Outline first.** Propose the structure before writing scenes: acts, the main decision points, and the endings. Use a branch and merge shape (paths split, then rejoin at key scenes) to keep the size manageable. Ask the user to approve or change the outline.

2. **Write scenes one at a time**, each with the path so far:
   ```
   Story: {title}. Premise: {premise}. Audience: {audience}. Style: {style}.
   Characters: {character notes}
   Path so far (summaries): {summaries}
   Write scene {id}: {outline line}. 40 to 120 words of narration and dialogue.
   Then 2 or 3 choices, each under 8 words, each leading to {allowed next ids}.
   Follow the content rules. Return JSON for this one scene only.
   ```

3. **Validate the tree after every few scenes.**
   ```python
   import json
   from collections import deque

   def validate(story: dict) -> list[str]:
       errs, scenes = [], story["scenes"]
       if story["start"] not in scenes:
           errs.append(f"start {story['start']} missing")
       for sid, s in scenes.items():
           has_choices, is_end = bool(s.get("choices")), "ending" in s
           if has_choices == is_end:
               errs.append(f"{sid}: needs choices or an ending, not both or neither")
           for c in s.get("choices", []):
               if c["next"] not in scenes:
                   errs.append(f"{sid}: choice '{c['label']}' points to missing {c['next']}")
               for var in list(c.get("effects", {})) + list(c.get("requires", {})):
                   if var not in story.get("variables", {}):
                       errs.append(f"{sid}: unknown variable {var}")
       seen, q = {story["start"]}, deque([story["start"]])
       while q:
           for c in scenes.get(q.popleft(), {}).get("choices", []):
               if c["next"] in scenes and c["next"] not in seen:
                   seen.add(c["next"]); q.append(c["next"])
       errs += [f"{sid}: unreachable" for sid in scenes if sid not in seen]
       # every scene must be able to reach an ending
       ends = {sid for sid, s in scenes.items() if "ending" in s}
       can_end, changed = set(ends), True
       while changed:
           changed = False
           for sid, s in scenes.items():
               if sid not in can_end and any(c["next"] in can_end for c in s.get("choices", [])):
                   can_end.add(sid); changed = True
       errs += [f"{sid}: no path to an ending" for sid in scenes if sid not in can_end]
       return errs
   ```
   Also check that no scene has all its choices locked by `requires` on every path. A simple check: if every choice in a scene has `requires`, flag it for review.

4. **Draw the map.** Mermaid (works in many Markdown viewers) and Graphviz for an image:
   ```python
   def to_mermaid(story):
       out = ["flowchart TD"]
       for sid, s in story["scenes"].items():
           label = s["text"][:40].replace('"', "'")
           shape = f'{sid}(["{label}"])' if "ending" in s else f'{sid}["{label}"]'
           out.append(f"  {shape}")
           for c in s.get("choices", []):
               out.append(f'  {sid} -->|{c["label"][:24]}| {c["next"]}')
       return "\n".join(out)

   def to_dot(story):
       lines = ["digraph story {", '  rankdir=TB; node [shape=box, style="rounded,filled", fillcolor="#F2F2F2", fontname="Segoe UI"];']
       for sid, s in story["scenes"].items():
           fill = "#CFE8D5" if s.get("ending") == "good" else "#F4C7C3" if s.get("ending") == "bad" else "#F2F2F2"
           label = json.dumps(f"{sid}: {s['text'][:40]}")
           lines.append(f"  {sid} [label={label}, fillcolor=\"{fill}\"];")
           for c in s.get("choices", []):
               lines.append(f"  {sid} -> {c['next']} [label={json.dumps(c['label'][:24])}];")
       lines.append("}")
       return "\n".join(lines)
   ```
   Render: `dot -Tpng story.dot -o story-map.png` and `-Tsvg` for a zoomable version.

5. **Content review pass.** Re-read every scene against the content rules and list any line that needs a change, with a suggested rewrite. Apply only after the user agrees.

6. **Play test.** Print every path from start to each ending as a numbered list of choices so the user can read them like a reader would.

## Output format

- `story.json`
- `story-map.md` (Mermaid), `story.dot`, `story-map.png` or `.svg`
- `paths.txt` with every path
- Chat summary: scene count, endings by type, longest and shortest path, validation result.

## Safety and confirmation rules

- Content rules above are always on.
- Never overwrite an existing `story.json`; save `story.v2.json` and show the differences.
- Never delete scenes without asking; unreachable scenes are reported, not removed.
- Nothing is published or shared.

## Quality checks

- `validate()` returns no errors.
- Every choice label is distinct within its scene.
- Character names and voices stay consistent (the skill checks each speaker id exists).
- Each ending is reachable.

## Examples

1. "Night Shift" premise, 15 scenes, 3 endings: outline, scenes, valid JSON, PNG map with endings colored.
2. Map mode: an existing 40 scene JSON with 2 dead links and 1 unreachable scene; the skill reports them and draws the map.
3. Training scenario: a customer service conversation with a `trust` variable that unlocks a better ending.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Characters change voice | Add voice notes to `characters` and keep the path summaries short. |
| Tree grows too large | Merge branches into shared scenes; the outline step controls size. |
| `dot` not found | Install Graphviz or use the Mermaid map. |
| JSON parse errors from the model | The skill asks for that one scene again with "return only JSON". |

## Limitations

- The map is readable up to about 60 scenes; larger trees are split by act.
- Variables are simple counters; no strings or complex logic.
- Writing quality depends on the model size.

## Changelog

- 1.0 (October 2026): First release. Outline first workflow, JSON format with variables, validator, Mermaid and Graphviz maps, SFW content rules.
