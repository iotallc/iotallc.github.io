---
name: Project Scaffolder
command: /scaffold
version: "1.0"
category: Building apps
editions: both
editions_reason: "Works in both editions. Templates are written locally. The WPF and Python templates build offline. The Android template needs Gradle and the Android SDK, and its first build downloads dependencies unless your Gradle cache already has them."
network: offline
network_note: "Offline once packages are cached. The xunit test project restores NuGet packages and Android needs one online build to fill the Gradle cache. The Python template works fully offline if pytest is installed."
author: "IOTA - Joseph Bryant"
license: "Free to use, copy, and adapt with credit to IOTA - Joseph Bryant. Provided as is, without warranty."
homepage: https://iotallc.github.io/skills/
---

# /scaffold: Project Scaffolder

Created by IOTA - Joseph Bryant. https://iotallc.github.io/

This file is a skill guide. It tells the model in IOTA how to do the job step by step. It is not a compiled program and it does not install anything. To use it, paste its text into an IOTA chat and then give your request, or read it and follow the steps yourself.

## Purpose

Create a new project that builds and passes its tests on the first try. Three templates are covered: a WPF MVVM desktop app, an Android app with Jetpack Compose, and a Python command line tool. Each comes with a test project, a README, and a `.gitignore`.

## When to use

- Starting a new app and you want a clean, tested structure instead of an empty folder.
- You want the same layout across projects so other skills (/fix-build, /repo-map, /package) work well.

## When not to use

- Adding features to an existing project. Use /wpf or ask directly.
- Web apps, game engines, or other stacks not listed here. The skill says so instead of guessing.

## Requirements

| Template | Needs |
|---|---|
| WPF MVVM | Windows, .NET 8 SDK |
| Android Compose | JDK 17, Android SDK (API 34), Gradle wrapper, Android Studio optional |
| Python CLI | Python 3.10 or later, `pytest` installed or available in a local wheel cache |

Model: Gemma 3 4B can fill these templates because the structure is fixed below. Larger Gemma or Nemotron models write better feature code on top.

## Inputs

| Input | Required | Example |
|---|---|---|
| Template | Yes | `wpf-mvvm`, `android-compose`, `python-cli` |
| Name | Yes | `PartTracker` or `part-tracker` |
| Folder | No | A new empty folder (default `./<name>`) |
| Package id (Android) | Android only | `com.example.parttracker` |

## Step-by-step procedure

1. **Check tools.** Run the version check for the chosen template and stop with a clear message if a tool is missing.
   ```powershell
   dotnet --list-sdks            # WPF
   java -version; $env:ANDROID_HOME   # Android
   python --version; python -m pytest --version   # Python
   ```

2. **Check the folder.** It must not exist or must be empty. If it has files, list them and ask. Never write into a folder with existing files without a yes.

3. **Create the template.**

### Template A: WPF MVVM

```powershell
$n = "PartTracker"
dotnet new sln -n $n -o $n
dotnet new wpf -n "$n.App" -o "$n/src/$n.App" --framework net8.0
dotnet new classlib -n "$n.Core" -o "$n/src/$n.Core" --framework net8.0
dotnet new xunit -n "$n.Tests" -o "$n/tests/$n.Tests" --framework net8.0
dotnet sln "$n/$n.sln" add "$n/src/$n.App" "$n/src/$n.Core" "$n/tests/$n.Tests"
dotnet add "$n/src/$n.App" reference "$n/src/$n.Core"
dotnet add "$n/tests/$n.Tests" reference "$n/src/$n.Core"
```
View models live in `Core` so tests can run without WPF. `src/PartTracker.Core/ViewModels/MainViewModel.cs`:
```csharp
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace PartTracker.Core.ViewModels;

public class MainViewModel : INotifyPropertyChanged
{
    private string _newPart = "";
    public ObservableCollection<string> Parts { get; } = new();

    public string NewPart
    {
        get => _newPart;
        set { if (_newPart != value) { _newPart = value; OnChanged(); } }
    }

    public bool AddPart()
    {
        var p = NewPart.Trim();
        if (p.Length == 0 || Parts.Contains(p)) return false;
        Parts.Add(p);
        NewPart = "";
        return true;
    }

    public event PropertyChangedEventHandler? PropertyChanged;
    private void OnChanged([CallerMemberName] string? n = null) =>
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(n));
}
```
`tests/PartTracker.Tests/MainViewModelTests.cs`:
```csharp
using PartTracker.Core.ViewModels;
using Xunit;

public class MainViewModelTests
{
    [Fact]
    public void AddPart_adds_trimmed_value_and_clears_input()
    {
        var vm = new MainViewModel { NewPart = "  A-100 " };
        Assert.True(vm.AddPart());
        Assert.Equal(new[] { "A-100" }, vm.Parts);
        Assert.Equal("", vm.NewPart);
    }

    [Fact]
    public void AddPart_rejects_blank_and_duplicates()
    {
        var vm = new MainViewModel { NewPart = " " };
        Assert.False(vm.AddPart());
        vm.NewPart = "A"; vm.AddPart();
        vm.NewPart = "A";
        Assert.False(vm.AddPart());
    }
}
```
Set `DataContext = new MainViewModel();` in `MainWindow.xaml.cs` and bind a `TextBox`, a `ListBox`, and an Add button. Delete the template's `UnitTest1.cs` only after telling the user (it is a file the skill created a moment ago, never a user file).

Verify:
```powershell
dotnet build "$n/$n.sln" -nologo
dotnet test "$n/$n.sln" -nologo
```

### Template B: Android Compose

Structure:
```
part-tracker/
  settings.gradle.kts
  build.gradle.kts
  gradle.properties
  app/build.gradle.kts
  app/src/main/AndroidManifest.xml
  app/src/main/java/com/example/parttracker/MainActivity.kt
  app/src/main/java/com/example/parttracker/PartList.kt
  app/src/test/java/com/example/parttracker/PartListTest.kt
```
`settings.gradle.kts`:
```kotlin
pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }
dependencyResolutionManagement { repositories { google(); mavenCentral() } }
rootProject.name = "part-tracker"
include(":app")
```
Root `build.gradle.kts`:
```kotlin
plugins {
    id("com.android.application") version "8.5.2" apply false
    id("org.jetbrains.kotlin.android") version "2.0.20" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.0.20" apply false
}
```
`gradle.properties`:
```
android.useAndroidX=true
org.gradle.jvmargs=-Xmx2g
```
`app/build.gradle.kts`:
```kotlin
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}
android {
    namespace = "com.example.parttracker"
    compileSdk = 34
    defaultConfig {
        applicationId = "com.example.parttracker"
        minSdk = 26; targetSdk = 34; versionCode = 1; versionName = "1.0"
    }
    buildFeatures { compose = true }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}
dependencies {
    implementation(platform("androidx.compose:compose-bom:2024.09.00"))
    implementation("androidx.activity:activity-compose:1.9.2")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.ui:ui")
    testImplementation("junit:junit:4.13.2")
}
```
Version numbers are known good pairs at the time of writing. If the user's Gradle cache has other versions, prefer those to stay offline.

`PartList.kt` holds plain logic so it can be unit tested without a device:
```kotlin
package com.example.parttracker

class PartList {
    private val items = mutableListOf<String>()
    val parts: List<String> get() = items
    fun add(raw: String): Boolean {
        val p = raw.trim()
        if (p.isEmpty() || p in items) return false
        items += p
        return true
    }
}
```
`MainActivity.kt`:
```kotlin
package com.example.parttracker

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { MaterialTheme(colorScheme = darkColorScheme()) { PartScreen() } }
    }
}

@Composable
fun PartScreen() {
    val list = remember { PartList() }
    var text by remember { mutableStateOf("") }
    var parts by remember { mutableStateOf(list.parts.toList()) }
    Surface(Modifier.fillMaxSize()) {
        Column(Modifier.padding(16.dp)) {
            Row {
                OutlinedTextField(text, { text = it }, Modifier.weight(1f), label = { Text("Part") })
                Spacer(Modifier.width(8.dp))
                Button(onClick = { if (list.add(text)) { text = ""; parts = list.parts.toList() } }) { Text("Add") }
            }
            parts.forEach { Text(it, Modifier.padding(top = 8.dp)) }
        }
    }
}
```
`PartListTest.kt`:
```kotlin
package com.example.parttracker

import org.junit.Assert.*
import org.junit.Test

class PartListTest {
    @Test fun addsTrimmed() { val l = PartList(); assertTrue(l.add(" A ")); assertEquals(listOf("A"), l.parts) }
    @Test fun rejectsDuplicate() { val l = PartList(); l.add("A"); assertFalse(l.add("A")) }
}
```
The manifest declares `MainActivity` with the `MAIN` and `LAUNCHER` intent filter and `android:exported="true"`. If no Gradle wrapper is present, run `gradle wrapper --gradle-version 8.9` once (online). Verify with `./gradlew testDebugUnitTest assembleDebug`.

### Template C: Python CLI

```
part-tracker/
  pyproject.toml
  src/part_tracker/__init__.py
  src/part_tracker/cli.py
  tests/test_cli.py
```
`pyproject.toml`:
```toml
[build-system]
requires = ["setuptools>=61"]
build-backend = "setuptools.build_meta"

[project]
name = "part-tracker"
version = "0.1.0"
requires-python = ">=3.10"

[project.scripts]
part-tracker = "part_tracker.cli:main"

[tool.pytest.ini_options]
pythonpath = ["src"]
```
`src/part_tracker/cli.py`:
```python
import argparse
import json
from pathlib import Path


def add_part(store: Path, part: str) -> bool:
    part = part.strip()
    parts = json.loads(store.read_text()) if store.exists() else []
    if not part or part in parts:
        return False
    parts.append(part)
    store.write_text(json.dumps(parts, indent=2))
    return True


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="part-tracker")
    ap.add_argument("--store", type=Path, default=Path("parts.json"))
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list")
    a = sub.add_parser("add"); a.add_argument("part")
    args = ap.parse_args(argv)
    if args.cmd == "add":
        ok = add_part(args.store, args.part)
        print("added" if ok else "skipped")
        return 0 if ok else 1
    for p in (json.loads(args.store.read_text()) if args.store.exists() else []):
        print(p)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```
`tests/test_cli.py`:
```python
from part_tracker.cli import add_part, main


def test_add_and_duplicate(tmp_path):
    store = tmp_path / "parts.json"
    assert add_part(store, " A-1 ")
    assert not add_part(store, "A-1")


def test_main_list(tmp_path, capsys):
    store = tmp_path / "parts.json"
    main(["--store", str(store), "add", "B-2"])
    main(["--store", str(store), "list"])
    assert "B-2" in capsys.readouterr().out
```
Verify: `python -m pytest -q` from the project folder.

4. **Add common files.** README with build, test, and run commands; `.gitignore` for the stack (`bin/ obj/` for .NET, `build/ .gradle/ local.properties` for Android, `__pycache__/ .venv/ *.egg-info/` for Python).

5. **Build and test.** Run the verify commands. If anything fails, use the /fix-build loop with a limit of 5 attempts. Report the final test count and result.

## Output format

A folder tree listing, the verify command output (pass or fail with counts), and the next three commands the user is likely to need.

## Safety and confirmation rules

- Only write into a new or empty folder unless the user says otherwise.
- Ask before any command that downloads packages (Gradle first build, `pip install`).
- Never delete anything outside the files this skill created in this run.
- Nothing is sent or published. No git remote is added.

## Quality checks

- Build passes and all template tests pass before the skill says "done".
- Names are consistent: solution, namespaces, package id, and folder.
- No absolute personal paths in any file.

## Examples

1. `/scaffold wpf-mvvm PartTracker`: solution with App, Core, Tests. `dotnet test` shows 2 passed.
2. `/scaffold python-cli part-tracker`: `pytest` shows 2 passed; `part-tracker add A-1` prints `added` after `pip install -e .`.
3. `/scaffold android-compose part-tracker com.example.parttracker`: Gradle unit tests pass and a debug APK is built under `app/build/outputs/apk/debug/`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `dotnet test` cannot find xunit offline | The xunit template restores packages. Run once online or use a local NuGet feed. |
| Gradle "Could not resolve" offline | Run one online build, then use `--offline`. |
| `SDK location not found` | Create `local.properties` with `sdk.dir=` pointing to your Android SDK. Do not commit it. |
| `ModuleNotFoundError: part_tracker` in pytest | Check `pythonpath = ["src"]` in `pyproject.toml`. |

## Limitations

- Library versions age. The skill prefers versions already on the PC.
- iOS is not covered.
- The WPF xunit test project and the Android build both need packages that are usually downloaded once.

## Changelog

- 1.0 (October 2026): First release. WPF MVVM, Android Compose, and Python CLI templates with tests.
