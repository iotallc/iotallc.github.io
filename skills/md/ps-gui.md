---
name: PowerShell Script GUI
command: /ps-gui
version: "1.0"
category: Building apps
editions: both
editions_reason: "Works in both editions. The PowerShell edition is the natural fit because the output is a PowerShell file that loads WPF directly, with no compiler. The EXE edition can produce the same file."
network: offline
author: "IOTA - Joseph Bryant"
license: "Free to use, copy, and adapt with credit to IOTA - Joseph Bryant. Provided as is, without warranty."
homepage: https://iotallc.github.io/skills/
---

# /ps-gui: PowerShell Script GUI

Created by IOTA - Joseph Bryant. https://iotallc.github.io/

This file is a skill guide. It tells the model in IOTA how to do the job step by step. It is not a compiled program and it does not install anything. To use it, paste its text into an IOTA chat and then give your request, or read it and follow the steps yourself.

## Purpose

Wrap an existing PowerShell script in a simple window so people who do not use a console can run it. The skill reads the script's `param()` block, makes one input per parameter, adds Run and Preview (`-WhatIf`) buttons, shows output live, and writes a log file for every run. The original script is not changed.

## When to use

- A teammate needs to run your cleanup, export, or setup script without typing parameters.
- A script supports `-WhatIf` and you want the preview to be the default.
- You want every run logged with who, when, and which parameters.

## When not to use

- Scripts that prompt with `Read-Host` in the middle. Convert those prompts to parameters first (the skill can propose this, but asks before editing).
- Long running services or scripts that need a console window to stay open.
- Scripts that must run elevated for every user. The GUI can request elevation, but this should be a conscious choice.

## Requirements

- Windows PowerShell 5.1 or PowerShell 7 on Windows (WPF needs Windows).
- The target script with a `param()` block.
- Model: Gemma 3 4B can generate this reliably because the template below does most of the work. Larger models handle unusual parameter types better.

## Inputs

| Input | Required | Example |
|---|---|---|
| Script path | Yes | `.\Clean-OldLogs.ps1` |
| Title | No | "Clean old logs" |
| Log folder | No | `.\logs` next to the GUI file |

## Step-by-step procedure

1. **Read parameters with the PowerShell parser** instead of guessing from text:
   ```powershell
   $path = Resolve-Path .\Clean-OldLogs.ps1
   $cmd = Get-Command $path
   $supportsWhatIf = $cmd.Parameters.ContainsKey('WhatIf')
   $common = [System.Management.Automation.PSCmdlet]::CommonParameters +
             [System.Management.Automation.PSCmdlet]::OptionalCommonParameters
   $params = $cmd.Parameters.Values | Where-Object { $common -notcontains $_.Name } | ForEach-Object {
       $attr = $_.Attributes | Where-Object { $_ -is [System.Management.Automation.ParameterAttribute] } | Select-Object -First 1
       $set  = $_.Attributes | Where-Object { $_ -is [System.Management.Automation.ValidateSetAttribute] } | Select-Object -First 1
       [pscustomobject]@{
           Name = $_.Name; Type = $_.ParameterType.Name
           Mandatory = [bool]$attr.Mandatory; Help = $attr.HelpMessage
           Choices = if ($set) { $set.ValidValues } else { $null }
       }
   }
   $params | Format-Table
   ```

2. **Map each parameter to a control.**

   | Parameter type | Control |
   |---|---|
   | `String`, `Int32`, `Double` | `TextBox` (numbers validated before run) |
   | `String` with `ValidateSet` | `ComboBox` |
   | `SwitchParameter`, `Boolean` | `CheckBox` |
   | Name ends in `Path`, `File`, `Folder` | `TextBox` plus Browse button |
   | `String[]` | multi line `TextBox`, one value per line |

3. **Show the plan** (controls, labels, mandatory marks) and ask the user to confirm before generating.

4. **Generate the GUI file** `<ScriptName>.gui.ps1` next to the script. Template:
   ```powershell
   #requires -Version 5.1
   # GUI wrapper generated with the /ps-gui skill guide by IOTA - Joseph Bryant
   Add-Type -AssemblyName PresentationFramework
   $ScriptPath = Join-Path $PSScriptRoot 'Clean-OldLogs.ps1'
   $LogDir = Join-Path $PSScriptRoot 'logs'

   [xml]$xaml = @'
   <Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
           xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
           Title="Clean old logs" Width="640" Height="520" Background="#050506">
     <Grid Margin="16">
       <Grid.RowDefinitions>
         <RowDefinition Height="Auto"/><RowDefinition Height="Auto"/><RowDefinition Height="*"/>
       </Grid.RowDefinitions>
       <Grid x:Name="Form">
         <Grid.ColumnDefinitions>
           <ColumnDefinition Width="140"/><ColumnDefinition Width="*"/><ColumnDefinition Width="Auto"/>
         </Grid.ColumnDefinitions>
         <Grid.RowDefinitions>
           <RowDefinition Height="Auto"/><RowDefinition Height="Auto"/><RowDefinition Height="Auto"/>
         </Grid.RowDefinitions>
         <TextBlock Text="Folder *" Foreground="#E0E0E0" Margin="0,6"/>
         <TextBox x:Name="p_Folder" Grid.Column="1" Margin="0,4" Background="#121212" Foreground="#E0E0E0"/>
         <Button x:Name="b_Folder" Grid.Column="2" Content="Browse" Margin="8,4,0,4" Padding="10,2"/>
         <TextBlock Grid.Row="1" Text="Days" Foreground="#E0E0E0" Margin="0,6"/>
         <TextBox x:Name="p_Days" Grid.Row="1" Grid.Column="1" Margin="0,4" Text="30" Background="#121212" Foreground="#E0E0E0"/>
         <CheckBox x:Name="p_Recurse" Grid.Row="2" Grid.Column="1" Content="Recurse" Foreground="#E0E0E0" Margin="0,6"/>
       </Grid>
       <StackPanel Grid.Row="1" Orientation="Horizontal" Margin="0,12">
         <Button x:Name="Preview" Content="Preview (WhatIf)" Padding="14,6" Margin="0,0,8,0" IsDefault="True"/>
         <Button x:Name="Run" Content="Run" Padding="14,6"/>
       </StackPanel>
       <TextBox x:Name="Output" Grid.Row="2" IsReadOnly="True" FontFamily="Consolas" TextWrapping="NoWrap"
                VerticalScrollBarVisibility="Auto" HorizontalScrollBarVisibility="Auto"
                Background="#121212" Foreground="#CBCBCB"/>
     </Grid>
   </Window>
   '@
   $win = [Windows.Markup.XamlReader]::Load((New-Object System.Xml.XmlNodeReader $xaml))
   $ui = @{}
   $xaml.SelectNodes('//*[@*[local-name()="Name"]]') | ForEach-Object {
       $n = $_.Attributes | Where-Object LocalName -eq 'Name' | Select-Object -ExpandProperty Value
       $ui[$n] = $win.FindName($n)
   }

   $ui.b_Folder.Add_Click({
       Add-Type -AssemblyName System.Windows.Forms
       $d = New-Object System.Windows.Forms.FolderBrowserDialog
       if ($d.ShowDialog() -eq 'OK') { $ui.p_Folder.Text = $d.SelectedPath }
   })

   function Get-Args {
       $a = @{}
       if ([string]::IsNullOrWhiteSpace($ui.p_Folder.Text)) { throw 'Folder is required.' }
       $a.Folder = $ui.p_Folder.Text
       $days = 0
       if (-not [int]::TryParse($ui.p_Days.Text, [ref]$days)) { throw 'Days must be a whole number.' }
       $a.Days = $days
       if ($ui.p_Recurse.IsChecked) { $a.Recurse = $true }
       return $a
   }

   function Invoke-Wrapped([bool]$WhatIf) {
       try { $a = Get-Args } catch { $ui.Output.Text = "Input error: $($_.Exception.Message)"; return }
       if ($WhatIf) { $a.WhatIf = $true }
       elseif ([Windows.MessageBox]::Show('Run for real? This makes changes.', 'Confirm', 'YesNo', 'Warning') -ne 'Yes') { return }
       New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
       $log = Join-Path $LogDir ("run-{0:yyyyMMdd-HHmmss}.log" -f (Get-Date))
       $header = "User: $env:USERNAME`nStart: $(Get-Date -Format o)`nWhatIf: $WhatIf`nArgs: $(($a.GetEnumerator() | ForEach-Object { "-$($_.Key) $($_.Value)" }) -join ' ')`n"
       $header | Set-Content -Path $log -Encoding UTF8
       $ui.Output.Text = $header
       $ui.Run.IsEnabled = $false; $ui.Preview.IsEnabled = $false
       try {
           & $ScriptPath @a *>&1 | ForEach-Object {
               $line = "$_"
               Add-Content -Path $log -Value $line
               $ui.Output.AppendText("$line`n"); $ui.Output.ScrollToEnd()
               [System.Windows.Forms.Application]::DoEvents()
           }
           Add-Content -Path $log -Value "End: $(Get-Date -Format o) OK"
       } catch {
           $msg = "Error: $($_.Exception.Message)"
           Add-Content -Path $log -Value $msg
           $ui.Output.AppendText("$msg`n")
       } finally {
           $ui.Run.IsEnabled = $true; $ui.Preview.IsEnabled = $true
           $ui.Output.AppendText("Log: $log`n")
       }
   }

   Add-Type -AssemblyName System.Windows.Forms
   $ui.Preview.Add_Click({ Invoke-Wrapped $true })
   $ui.Run.Add_Click({ Invoke-Wrapped $false })
   [void]$win.ShowDialog()
   ```
   Notes on the template:
   - `DoEvents` keeps the window responsive for short scripts. For scripts that run for minutes, the skill switches to a background runspace and a `DispatcherTimer` that drains a queue; it says so when it makes that switch.
   - If the script does not support `-WhatIf`, the Preview button is left out and the Run confirmation text says "This script has no preview mode."
   - `*>&1` merges all output streams, so `Write-Warning` and `Write-Verbose` (when enabled) appear in the log.

5. **Add a launcher** (optional, ask first) `Clean old logs.cmd`:
   ```bat
   @echo off
   powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File "%~dp0Clean-OldLogs.gui.ps1"
   ```
   Explain that `-ExecutionPolicy Bypass` applies only to this process. If the user's organization requires signed scripts, use code signing instead (see /package).

6. **Test.** Run the GUI, press Preview with sample values, confirm output appears and a log file is written. Screenshot it as in /wpf.

## Output format

- `<ScriptName>.gui.ps1` (and optional `.cmd` launcher) next to the script.
- A `logs` folder created on first run.
- A chat reply with the parameter table, the screenshot, and how to start it.

## Safety and confirmation rules

- The original script is never modified.
- Preview is the default button. Run asks for confirmation every time.
- Never overwrite an existing `.gui.ps1` without asking; offer `.gui.v2.ps1` instead.
- Logs record parameters. If a parameter looks like a password or token (name contains `Password`, `Secret`, `Token`, `Key`, or type `SecureString`), the GUI uses a `PasswordBox` and writes `***` to the log.
- Nothing is sent anywhere.

## Quality checks

- Every non common parameter has a control; mandatory ones are marked with `*` and checked before running.
- Numbers are validated before the script starts.
- The GUI file parses: `[System.Management.Automation.Language.Parser]::ParseFile($f, [ref]$null, [ref]$errs)` returns no errors.
- The window opens with `-STA` (required for WPF in Windows PowerShell).

## Examples

1. `Clean-OldLogs.ps1 -Folder -Days -Recurse -WhatIf`: the template above.
2. `Export-Users.ps1 -Department (ValidateSet Sales, Ops, IT) -OutFile`: a ComboBox, a Save As button, and no Preview because the script has no `SupportsShouldProcess`.
3. `Set-PrinterDefaults.ps1` with a `SecureString` credential: a `PasswordBox`, `***` in logs.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "The calling thread must be STA" | Start with `powershell.exe -STA`, or use PowerShell 7 which is STA by default for `-File` on Windows. |
| Window freezes during long runs | Ask the skill to switch to the runspace version. |
| Script not found | The GUI uses `$PSScriptRoot`; keep both files in the same folder. |
| Blocked by execution policy | Use the `.cmd` launcher or sign the scripts. |

## Limitations

- Dynamic parameters and parameter sets are shown as plain inputs; sets are not enforced in the GUI.
- `Read-Host` prompts inside the script will not appear in the window.
- Windows only.

## Changelog

- 1.0 (October 2026): First release. Parser based parameter discovery, Preview default, confirmation, per run logs, secret masking.
