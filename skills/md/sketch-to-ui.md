---
name: Sketch to UI
command: /sketch-to-ui
version: "1.0"
category: Building apps
editions: both
editions_reason: "Works in both editions. The image is read by a local vision model, and the output is plain files, so nothing leaves your PC. The EXE edition is easier if you want to drag an image into the chat."
network: offline
author: "IOTA - Joseph Bryant"
license: "Free to use, copy, and adapt with credit to IOTA - Joseph Bryant. Provided as is, without warranty."
homepage: https://iotallc.github.io/skills/
---

# /sketch-to-ui: Sketch to UI

Created by IOTA - Joseph Bryant. https://iotallc.github.io/

This file is a skill guide. It tells the model in IOTA how to do the job step by step. It is not a compiled program and it does not install anything. To use it, paste its text into an IOTA chat and then give your request, or read it and follow the steps yourself.

## Purpose

Turn a photo of a paper sketch, a whiteboard drawing, or a screenshot of another app into a working layout. The skill reads the image, lists every region it found, confirms that list with you, and then writes WPF XAML or a single HTML page in the IOTA palette.

## When to use

- You drew a screen on paper and want a first working version.
- You have a screenshot of an old tool and want the same layout rebuilt.
- You want to compare two layout ideas quickly.

## When not to use

- Pixel perfect copies of someone else's product. The skill rebuilds structure, not artwork, logos, or brand assets.
- Complex charts or drawings inside the sketch. Those become placeholders.
- When no vision model is loaded and you do not want to describe the regions by hand.

## Requirements

- A local vision capable model. Gemma 3 4B, 12B, and 27B accept images. 12B or larger reads handwriting much better than 4B.
- For the WPF target: the .NET 8 SDK (see /wpf).
- For the HTML target: any browser.
- A clear image: good light, the whole sketch in frame, dark pen on light paper. 1000 to 2000 pixels on the long side is plenty.

**Fallback without vision.** If the loaded model cannot read images, the skill says so and asks you to describe the regions in this format instead:
```
top bar: title "Shift log", buttons New and Export on the right
left column, 30 percent: list of shifts
right: form with Date, Operator, Notes (multi line), Save button
bottom: status text
```

## Inputs

| Input | Required | Example |
|---|---|---|
| Image | Yes, or a text description | `sketch.jpg` |
| Target | No | `wpf` (default) or `html` |
| Window size | No | `1000x640` (default) |
| Notes | No | "The list should be sortable" |

## Step-by-step procedure

1. **Check vision support.** If the model cannot take the image, switch to the text fallback above and continue from step 4.

2. **Read the image with this prompt.** The skill sends the image with a fixed prompt so the answer is structured:
   ```
   You are reading a user interface sketch. List every region you can see.
   For each region give: id, type (title, toolbar, button, text input,
   multi line input, dropdown, checkbox, list, table, image, text, panel),
   label text exactly as written (or "unreadable"), and position as
   left, top, width, height in percent of the whole sketch.
   Answer only with JSON: {"regions":[{"id":"r1","type":"...","label":"...",
   "box":[l,t,w,h]}], "notes":"anything unclear"}
   Do not guess hidden text. Mark unclear labels as "unreadable".
   ```

3. **Validate the JSON.** Parse it. If parsing fails, ask the model once more with "Return only valid JSON." If it fails again, fall back to the text description.
   ```python
   import json

   def load_regions(text: str) -> list[dict]:
       start, end = text.find("{"), text.rfind("}")
       data = json.loads(text[start:end + 1])
       out = []
       for r in data.get("regions", []):
           l, t, w, h = (float(v) for v in r["box"])
           if w <= 0 or h <= 0:
               continue
           out.append({**r, "box": [max(0, l), max(0, t), min(100, w), min(100, h)]})
       return sorted(out, key=lambda r: (round(r["box"][1] / 5), r["box"][0]))
   ```

4. **Confirm with the user.** Show a short table: id, type, label, rough position. Ask: "Is this right? Tell me what to add, remove, or rename." Do not write any code until the user says the list is right or says "go".

5. **Group regions into a layout.** Rules:
   - Regions whose top edges are within 5 percent of each other form a row.
   - A region taller than 50 percent beside other regions becomes a side column.
   - Buttons in the same row become a horizontal button bar.
   - A label directly left of or above an input becomes that input's label.

6. **Write the output.**

   *WPF target.* Follow /wpf for the project and palette. Map types like this:

   | Sketch type | WPF control |
   |---|---|
   | title | `TextBlock FontSize="22" FontWeight="SemiBold"` |
   | button | `Button` |
   | text input | `TextBox` |
   | multi line input | `TextBox AcceptsReturn="True" TextWrapping="Wrap" MinHeight="90"` |
   | dropdown | `ComboBox` |
   | checkbox | `CheckBox` |
   | list | `ListBox` |
   | table | `DataGrid AutoGenerateColumns="False"` |
   | image | `Border` with a `TextBlock` "Image placeholder" |

   Example output for the shift log sketch:
   ```xml
   <Grid Margin="16">
     <Grid.RowDefinitions>
       <RowDefinition Height="Auto"/><RowDefinition Height="*"/><RowDefinition Height="Auto"/>
     </Grid.RowDefinitions>
     <Grid.ColumnDefinitions>
       <ColumnDefinition Width="3*"/><ColumnDefinition Width="7*"/>
     </Grid.ColumnDefinitions>
     <DockPanel Grid.ColumnSpan="2" Margin="0,0,0,12">
       <StackPanel Orientation="Horizontal" DockPanel.Dock="Right">
         <Button Content="New"/><Button Content="Export"/>
       </StackPanel>
       <TextBlock Text="Shift log" FontSize="22" FontWeight="SemiBold"/>
     </DockPanel>
     <ListBox x:Name="Shifts" Grid.Row="1" Margin="0,0,12,0"/>
     <Grid Grid.Row="1" Grid.Column="1">
       <Grid.ColumnDefinitions><ColumnDefinition Width="Auto"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions>
       <Grid.RowDefinitions>
         <RowDefinition Height="Auto"/><RowDefinition Height="Auto"/><RowDefinition Height="*"/><RowDefinition Height="Auto"/>
       </Grid.RowDefinitions>
       <TextBlock Text="Date" Margin="0,6,12,6"/><DatePicker Grid.Column="1" Margin="0,4"/>
       <TextBlock Grid.Row="1" Text="Operator" Margin="0,6,12,6"/><TextBox Grid.Row="1" Grid.Column="1" Margin="0,4"/>
       <TextBlock Grid.Row="2" Text="Notes" Margin="0,6,12,6"/>
       <TextBox Grid.Row="2" Grid.Column="1" AcceptsReturn="True" TextWrapping="Wrap" Margin="0,4"/>
       <Button Grid.Row="3" Grid.Column="1" Content="Save" HorizontalAlignment="Right" Margin="0,8,0,0"/>
     </Grid>
     <TextBlock Grid.Row="2" Grid.ColumnSpan="2" Text="Ready" Foreground="#9A9A9A" Margin="0,10,0,0"/>
   </Grid>
   ```

   *HTML target.* One file, no external libraries, CSS grid:
   ```html
   <!doctype html>
   <html lang="en"><head><meta charset="utf-8">
   <meta name="viewport" content="width=device-width,initial-scale=1">
   <title>Shift log</title>
   <style>
     :root{--bg:#050506;--surface:#121212;--border:#2A2A2A;--text:#E0E0E0;--muted:#9A9A9A;--accent:#8EB8D4}
     body{margin:0;background:var(--bg);color:var(--text);font:15px "Segoe UI",system-ui,sans-serif}
     .app{display:grid;grid-template:auto 1fr auto / 3fr 7fr;gap:12px;height:100vh;padding:16px;box-sizing:border-box}
     header{grid-column:1/-1;display:flex;justify-content:space-between;align-items:center}
     .panel{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:12px}
     button{background:var(--surface);color:var(--text);border:1px solid var(--accent);border-radius:8px;padding:6px 14px}
     input,textarea{width:100%;box-sizing:border-box;background:#1A1A1A;color:var(--text);border:1px solid var(--border);padding:6px}
     footer{grid-column:1/-1;color:var(--muted)}
   </style></head>
   <body><div class="app">
     <header><h1>Shift log</h1><div><button>New</button> <button>Export</button></div></header>
     <ul class="panel" aria-label="Shifts"></ul>
     <form class="panel">
       <label>Date <input type="date"></label>
       <label>Operator <input></label>
       <label>Notes <textarea rows="5"></textarea></label>
       <button type="button">Save</button>
     </form>
     <footer>Ready</footer>
   </div></body></html>
   ```

7. **Build or open.** For WPF, run `dotnet build` and take a screenshot as in /wpf. For HTML, open the file in the browser and, if a headless browser is available, save a screenshot.

8. **Compare.** Show the sketch and the screenshot side by side and list any region that was dropped or moved. Ask the user for changes, then edit and rebuild.

## Output format

- The region table (as confirmed).
- `MainWindow.xaml` plus project files, or `index.html`.
- A screenshot and a list of differences from the sketch.

## Safety and confirmation rules

- Always confirm the region list before writing code.
- Never overwrite or delete files without asking. Show diffs for edits.
- Images stay on the PC. The skill does not upload them.
- Do not copy logos, trademarks, or artwork from a screenshot of another product.

## Quality checks

- Every confirmed region appears in the output exactly once.
- Labels match the sketch text, or are marked as placeholders when unreadable.
- WPF builds with 0 errors, or the HTML file passes a basic check (opens, no console errors).
- Tab order follows reading order: top to bottom, left to right.
- All inputs have a visible label.

## Examples

1. **Input:** a phone photo of a login sketch with two boxes and a button. **Output:** a 420 x 300 WPF window with Username, Password (`PasswordBox`), and Sign in, plus a screenshot.
2. **Input:** a screenshot of an old VB6 order form, target `html`. **Output:** one HTML file with the same form fields in a two column grid, the logo replaced by a placeholder.
3. **Input:** no vision model, text description of a dashboard with four tiles and a table. **Output:** WPF `UniformGrid` with four tiles and a `DataGrid` underneath.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Many labels "unreadable" | Retake the photo with better light, or type the labels in the confirmation step. |
| Regions overlap in the output | Positions were rough. Tell the skill which region belongs to which row. |
| Model returns prose, not JSON | The skill retries once, then uses the text fallback. |
| Small model misses regions | Use Gemma 3 12B or larger, or crop the image into halves. |

## Limitations

- Vision models estimate positions; expect to adjust spacing.
- Handwriting recognition is weaker on small models.
- Free form drawings, charts, and icons become placeholders.

## Changelog

- 1.0 (October 2026): First release. Vision prompt, JSON validation, confirmation step, WPF and HTML targets.
