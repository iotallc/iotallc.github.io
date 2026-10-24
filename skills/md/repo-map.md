---
name: Repository Map
command: /repo-map
version: "1.0"
category: Building apps
editions: both
editions_reason: "Works in both editions. The index is built and searched on your PC with a local embedding model and a local file, so source code never leaves the machine."
network: offline
author: "IOTA - Joseph Bryant"
license: "Free to use, copy, and adapt with credit to IOTA - Joseph Bryant. Provided as is, without warranty."
homepage: https://iotallc.github.io/skills/
---

# /repo-map: Repository Map

Created by IOTA - Joseph Bryant. https://iotallc.github.io/

This file is a skill guide. It tells the model in IOTA how to do the job step by step. It is not a compiled program and it does not install anything. To use it, paste its text into an IOTA chat and then give your request, or read it and follow the steps yourself.

## Purpose

Index a codebase so you can ask "where is X handled?" and get file paths with line numbers, and draw a Mermaid diagram of how folders and modules depend on each other. It uses retrieval (RAG): code is split into chunks, embedded locally, and the closest chunks are passed to the model with their locations.

## When to use

- You joined a project, or came back to an old one, and need to find things quickly.
- You want a picture of module dependencies before a refactor.
- Before /fix-build on a large project, to find related files.

## When not to use

- Tiny projects with a handful of files. Just open them.
- Generated code, minified bundles, or vendored libraries. They are skipped by default.
- Questions about runtime behavior ("why is this slow?"). The map shows structure, not performance.

## Requirements

- Python 3.10 or later with `numpy`.
- A local embedding model served by IOTA, or `sentence-transformers` with a model already downloaded (for example `all-MiniLM-L6-v2`). Embedding models are separate from the chat model.
- Chat model: Gemma 3 4B answers "where is" questions well when given the chunks. Explaining design across many files is better with Gemma 3 12B or 27B or a Nemotron model.
- Disk: about 2 KB per chunk for vectors plus the text.

## Inputs

| Input | Required | Default |
|---|---|---|
| Repo folder | Yes | current folder |
| Include extensions | No | `.cs .xaml .py .kt .java .ts .tsx .js .ps1 .psm1 .cpp .h .go .rs .md` |
| Exclude folders | No | `.git bin obj build dist node_modules .venv venv __pycache__ .gradle` plus `.gitignore` entries |
| Question | For "where" mode | "where is the CSV export?" |

## Step-by-step procedure

1. **List files** with the include and exclude rules. Skip files over 1 MB and files that look binary (contain a NUL byte in the first 8 KB). Report the file count by extension.

2. **Chunk by structure.** Split at function or class boundaries when possible, else every 60 lines with 10 lines of overlap. Keep the file path and start and end lines with each chunk.
   ```python
   import re
   from pathlib import Path

   BOUNDARY = re.compile(r"^\s*(def |class |public |private |internal |protected |fun |function |export |func |fn )")

   def chunks(path: Path, max_lines: int = 60, overlap: int = 10):
       lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
       start = 0
       while start < len(lines):
           end = min(start + max_lines, len(lines))
           # try to end at a boundary within the last 20 lines of the window
           for j in range(end - 1, max(start + 20, end - 20), -1):
               if BOUNDARY.match(lines[j]):
                   end = j
                   break
           text = "\n".join(lines[start:end])
           if text.strip():
               yield {"file": str(path), "start": start + 1, "end": end, "text": text}
           if end >= len(lines):
               break
           start = max(end - overlap, start + 1)
   ```

3. **Embed and store.** Write vectors to `.iota/repo-map/index.npz` and metadata to `meta.jsonl` inside the repo (ask first; offer a folder outside the repo instead). Add `.iota/` to `.gitignore` only with permission.
   ```python
   import json
   import numpy as np
   from sentence_transformers import SentenceTransformer

   def build(chunks_list, out_dir: Path, model_name="all-MiniLM-L6-v2"):
       model = SentenceTransformer(model_name)   # must already be downloaded for offline use
       texts = [f"{c['file']}\n{c['text']}" for c in chunks_list]
       vecs = model.encode(texts, batch_size=32, normalize_embeddings=True, show_progress_bar=True)
       out_dir.mkdir(parents=True, exist_ok=True)
       np.savez_compressed(out_dir / "index.npz", vecs=vecs.astype("float32"))
       with open(out_dir / "meta.jsonl", "w", encoding="utf-8") as f:
           for c in chunks_list:
               f.write(json.dumps(c) + "\n")
   ```
   For offline use set `HF_HUB_OFFLINE=1` so the library does not try to download.

4. **Keep it fresh.** Store each file's modified time and size in `files.json`. On the next run, re-embed only changed files and drop deleted ones.

5. **Answer "where is X".** Embed the question, take the top 8 chunks by cosine similarity, then boost chunks whose text contains exact identifiers from the question (words in `CamelCase`, `snake_case`, or quotes).
   ```python
   def search(question, model, vecs, meta, k=8):
       q = model.encode([question], normalize_embeddings=True)[0]
       scores = vecs @ q
       words = set(re.findall(r"[A-Za-z_][A-Za-z0-9_]{3,}", question))
       for i, m in enumerate(meta):
           if any(w in m["text"] for w in words if not w.islower()):
               scores[i] += 0.15
       top = np.argsort(-scores)[:k]
       return [(float(scores[i]), meta[i]) for i in top]
   ```
   Prompt for the chat model:
   ```
   Question: {question}
   Below are code excerpts with their file and line range. Answer only from
   these excerpts. Name the most relevant file and line range first, then up
   to three others. If the excerpts do not answer the question, say so.

   [1] {file}:{start}-{end}
   {text}
   ...
   ```

6. **Draw the dependency diagram.** Parse imports per language and roll them up to the folder level (two levels deep by default) so the diagram stays readable.

   | Language | Pattern |
   |---|---|
   | C# | `^using ([\w.]+);` mapped to project namespaces; also `<ProjectReference>` in `.csproj` |
   | Python | `^(?:from ([\w.]+) import|import ([\w.]+))` |
   | Kotlin, Java | `^import ([\w.]+)` |
   | TypeScript, JS | `from ['"](\.{1,2}/[^'"]+)['"]` (relative only) |

   Only keep edges between modules inside the repo. Then write Mermaid:
   ```python
   def mermaid(edges: dict[tuple[str, str], int]) -> str:
       ids = {}
       def nid(name):
           return ids.setdefault(name, f"n{len(ids)}")
       lines = ["graph LR"]
       for (a, b), n in sorted(edges.items(), key=lambda e: -e[1])[:60]:
           lines.append(f'  {nid(a)}["{a}"] -->|{n}| {nid(b)}["{b}"]')
       return "\n".join(lines)
   ```
   Example output:
   ```mermaid
   graph LR
     n0["src/App"] -->|14| n1["src/Core"]
     n2["tests"] -->|9| n1["src/Core"]
     n1["src/Core"] -->|3| n3["src/Data"]
   ```
   Point out cycles (A depends on B and B on A) because they usually matter for refactors.

## Output format

- "Where" answers: a ranked list of `file:start-end` with one line on why each matters, followed by the model's short explanation.
- Map: `repo-map.md` with the Mermaid block, a table of modules with file counts, and a list of cycles.
- Index files under `.iota/repo-map/` (or the folder the user chose).

## Safety and confirmation rules

- Read only on source files. The only writes are the index folder and `repo-map.md`, after the user agrees on the location.
- Skip files that look like secrets: `.env`, `*.pfx`, `*.pem`, `*.key`, `id_rsa*`, `secrets.*`, `appsettings.*.json` with `Password` or `ConnectionString` keys. Report that they were skipped.
- Never overwrite an existing `repo-map.md` without asking.
- Nothing leaves the PC.

## Quality checks

- Every cited line range exists and the cited text matches the file at search time (re-read before answering).
- The diagram has at most 60 edges; if more exist, the skill rolls up one more folder level.
- Answers say "not found in the index" instead of guessing.

## Examples

1. "Where is the CSV export?" Returns `src/Core/Export/CsvWriter.cs:12-58` first, then the button handler in `MainWindow.xaml.cs:88-104`.
2. "/repo-map diagram" on a three project .NET solution. Shows App to Core, Tests to Core, and Core to Data, no cycles.
3. "Which files read the config file?" Finds the loader and two callers, notes one call site in a test.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Model download attempted offline | Set `HF_HUB_OFFLINE=1` and point to a model folder already on disk. |
| Poor results for exact names | The identifier boost helps; also try `rg -n Name` style exact search, which the skill can run alongside. |
| Diagram too busy | Lower the roll up depth to 1. |
| Index stale | Run `/repo-map refresh`. |

## Limitations

- Import parsing is pattern based. Reflection, dependency injection, and dynamic imports are not seen.
- Very large monorepos take a while to embed the first time.
- The model can only answer from retrieved chunks; broad "how does the whole app work" questions get a partial answer.

## Changelog

- 1.0 (October 2026): First release. Structure aware chunking, local embeddings, identifier boost, Mermaid dependency map.
