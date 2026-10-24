---
name: Fix the Build
command: /fix-build
version: "1.0"
category: Building apps
editions: both
editions_reason: "Works in both editions. It runs your existing build command on your PC and edits local files. Nothing needs the network unless the build itself restores packages."
network: offline
author: "IOTA - Joseph Bryant"
license: "Free to use, copy, and adapt with credit to IOTA - Joseph Bryant. Provided as is, without warranty."
homepage: https://iotallc.github.io/skills/
---

# /fix-build: Fix the Build

Created by IOTA - Joseph Bryant. https://iotallc.github.io/

This file is a skill guide. It tells the model in IOTA how to do the job step by step. It is not a compiled program and it does not install anything. To use it, paste its text into an IOTA chat and then give your request, or read it and follow the steps yourself.

## Purpose

Run a build or test command, read the errors, make the smallest fix, show the diff, and run it again. The loop stops when the build is green, when the iteration limit is reached, or when a fix would need a decision from you.

## When to use

- A project stopped building after a change.
- Tests fail and the error messages point at specific lines.
- A generated project from /wpf, /scaffold, or /sketch-to-ui did not build on the first try.

## When not to use

- Failures caused by missing tools or SDKs. The skill reports these instead of editing code.
- Flaky tests that pass and fail randomly. The skill will say it found a flaky test and stop.
- Large refactors or design changes. Ask for those directly.

## Requirements

- The project's normal build tool on PATH: `dotnet`, `gradlew`, `python -m pytest`, `npm`, `cargo`, or `msbuild`.
- Git is strongly recommended. With git, every change is easy to review and undo with `git diff` and `git restore`.
- Model: Gemma 3 12B or a Nemotron model of similar size handles most compiler errors. Gemma 3 4B fixes simple errors (typos, missing `using`, wrong names) but can loop on type errors; the iteration limit protects against that.

## Inputs

| Input | Required | Default |
|---|---|---|
| Project folder | Yes | current folder |
| Build command | No | detected (see step 1) |
| Max iterations | No | 5 |
| Mode | No | `ask` (confirm each fix). `auto` applies fixes without asking but still never deletes code. |

## Step-by-step procedure

1. **Detect the build command** when none was given:

   | Found | Command |
   |---|---|
   | `*.sln` or `*.csproj` | `dotnet build -nologo -v q` then `dotnet test -nologo` |
   | `gradlew` or `gradlew.bat` | `./gradlew assembleDebug testDebugUnitTest` |
   | `pyproject.toml` or `pytest.ini` | `python -m pytest -q` |
   | `package.json` with a `build` script | `npm run build` |
   | `Cargo.toml` | `cargo build` |

   Tell the user which command will run.

2. **Take a safety snapshot.** If the folder is a git repo, record `git status --porcelain` and the current `git stash list` count. If it is not a repo, copy each file before its first edit to `<file>.fixbuild.bak` and tell the user where the copies are.

3. **Run the build and capture output.**
   ```powershell
   $log = & dotnet build -nologo -v q 2>&1 | Out-String
   $code = $LASTEXITCODE
   ```

4. **Parse errors into a list.** Keep the first 10 unique errors. Common formats:
   ```python
   import re

   PATTERNS = [
       # MSBuild / C#: path(line,col): error CS0103: message
       re.compile(r"^(?P<file>[^\s(][^(]*)\((?P<line>\d+),(?P<col>\d+)\): error (?P<code>\w+): (?P<msg>.+?)(?: \[.*\])?$"),
       # Kotlin: e: file:///path/File.kt:12:5 message
       re.compile(r"^e: (?:file://)?(?P<file>.+?):(?P<line>\d+):(?P<col>\d+) (?P<msg>.+)$"),
       # Python traceback last frame
       re.compile(r'^\s*File "(?P<file>.+?)", line (?P<line>\d+)'),
       # TypeScript: file(line,col): error TS2304: message
       re.compile(r"^(?P<file>.+?)\((?P<line>\d+),(?P<col>\d+)\): error (?P<code>TS\d+): (?P<msg>.+)$"),
   ]

   def parse(log: str) -> list[dict]:
       seen, out = set(), []
       for raw in log.splitlines():
           for pat in PATTERNS:
               m = pat.match(raw.strip())
               if m:
                   key = (m.group("file"), m.group("line"), m.groupdict().get("msg"))
                   if key not in seen:
                       seen.add(key)
                       out.append(m.groupdict())
                   break
       return out[:10]
   ```

5. **Classify the first error.**
   - *Code error*: a name, type, syntax, or test assertion in project code. Go to step 6.
   - *Environment error*: SDK missing, package restore failed, permission denied, path too long. Stop and explain the fix to the user. Do not edit code.
   - *Decision needed*: the fix would change public behavior, remove a feature, or change a test's expected value. Stop and ask.

6. **Read context.** Open the file around the error line (20 lines before and after) plus any file named in the error message. Use this prompt:
   ```
   Build error:
   {file}({line},{col}): {code} {msg}

   Code around the error (line numbers on the left):
   {snippet}

   Propose the smallest change that fixes this error without changing what
   the code is meant to do. Reply with a unified diff only. Do not delete
   functions, classes, or tests. If the right fix is unclear, reply with
   QUESTION: and one question for the user.
   ```

7. **Check the proposed diff before applying.** Reject it and ask the model again (once) if:
   - It removes more than 3 lines of user code, or removes any function, class, or test.
   - It comments out code or adds `#pragma warning disable`, `@Suppress`, `# type: ignore`, `skip`, or `[Fact(Skip=...)]` to silence the error.
   - It edits files outside the project folder.
   If the second proposal is also rejected, stop and show both to the user.

8. **Show and apply.** Print the diff. In `ask` mode wait for yes. Apply with `git apply` when in a repo:
   ```powershell
   $diff | Set-Content -Encoding utf8 fix.patch
   git apply --check fix.patch; if ($LASTEXITCODE -eq 0) { git apply fix.patch }
   Remove-Item fix.patch
   ```

9. **Rebuild and compare.** Run the build again. Track the error count each round:
   - Fewer errors: continue.
   - Same error again after a fix: try one different approach, then stop.
   - More errors than before: undo the last change (`git restore` the file or copy back the `.bak`) after telling the user, then stop.

10. **Stop conditions.** Green build, max iterations reached, environment error, decision needed, or no progress for 2 rounds.

11. **Report.** Summarize what changed and what is left.

## Output format

```
/fix-build report
Command: dotnet build -nologo -v q
Rounds: 3 of 5
Result: build succeeded, 12 tests passed
Changes:
  1. src/App/MainWindow.xaml.cs:14  added "using System.Linq;" (CS1061)
  2. src/Core/Parser.cs:42          renamed Parce to Parse (CS0103)
  3. tests/ParserTests.cs:9         fixed namespace import (CS0246)
Undo: git restore src/App/MainWindow.xaml.cs src/Core/Parser.cs tests/ParserTests.cs
```

## Safety and confirmation rules

- Never delete user code, files, or tests without asking first.
- Never silence errors by disabling warnings, skipping tests, or commenting out code.
- Never change a test's expected value without asking.
- Never run `git reset --hard`, `git clean`, or force push.
- Back up files before editing in folders without git.
- Nothing is sent or pushed anywhere.

## Quality checks

- Every applied change is shown as a diff in the chat.
- The final build output is quoted, not summarized from memory.
- The error count never ends higher than it started.

## Examples

1. **C#:** `CS0103: The name 'Results' does not exist`. The XAML had `x:Name="Result"`. The skill proposes renaming the XAML name to match, shows the one line diff, rebuilds: green in 1 round.
2. **Python:** `AssertionError: assert 3 == 4` in `test_total`. The skill sees the function adds tax twice, proposes the fix, and asks first because it changes behavior. After yes, tests pass.
3. **Gradle:** `SDK location not found`. Environment error: the skill explains `local.properties` and edits nothing.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Loop repeats the same fix | The stop rule triggers after 2 rounds without progress. Read the error yourself or try a larger model. |
| Errors in generated files (`obj/`, `build/`) | Fix the source that generates them, or run a clean build: `dotnet clean`. |
| Hundreds of errors | Usually one root cause (a missing reference or a broken file). The skill fixes the first error only, then rebuilds. |
| `git apply` fails | The file changed since it was read. The skill re-reads and asks for a new diff. |

## Limitations

- Linker errors, native build errors, and code generators are harder; expect more questions.
- The skill cannot verify that a fix is correct beyond building and passing tests.
- With no tests, a green build only means the code compiles.

## Changelog

- 1.0 (October 2026): First release. Detection table, error parsers, diff guard rules, iteration limit, report format.
