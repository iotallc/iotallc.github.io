---
name: WPF Window Builder
command: /wpf
version: "1.0"
category: Building apps
editions: both
editions_reason: "Works in the PowerShell edition and the EXE edition. Everything runs on your PC: the model writes the files and the .NET SDK builds them. No network access is needed once the .NET SDK is installed."
network: offline
author: "IOTA - Joseph Bryant"
license: "Free to use, copy, and adapt with credit to IOTA - Joseph Bryant. Provided as is, without warranty."
homepage: https://iotallc.github.io/skills/
---

# /wpf: WPF Window Builder

Created by IOTA - Joseph Bryant. https://iotallc.github.io/

This file is a skill guide. It tells the model in IOTA for Windows how to do the job step by step. It is not a compiled program and it does not install anything. To use it, paste its text into an IOTA chat and then give your request, or read it and follow the steps yourself.

## Purpose

Turn a plain description of a desktop window into a working WPF project: XAML for the layout, C# code-behind or an MVVM view model for the behavior, the IOTA color palette applied, a local build with `dotnet`, a screenshot of the result, and a loop for change requests.

## When to use

- You want a small Windows tool with a real window: a form, a dashboard, a settings screen, a file picker utility.
- You have a description such as "a window with a file list on the left, a preview on the right, and Save and Cancel buttons".
- You want to change an existing generated window: "make the list wider", "add a search box".

## When not to use

- Web pages or cross platform apps. Use /scaffold or /sketch-to-ui with the HTML target instead.
- Wrapping an existing PowerShell script in a window. Use /ps-gui.
- Large existing applications with their own style system. The skill can help with one window at a time, but it will not refactor a whole app.

## Requirements

- Windows 10 or 11.
- .NET 8 SDK or later. Check with `dotnet --list-sdks`. WPF projects need the Windows desktop workload, which ships with the standard SDK installer on Windows.
- A local model that writes C# and XAML reliably. Gemma 3 12B or a Nemotron model of similar size gives the best results. Gemma 3 4B can handle simple forms but makes more XAML mistakes, so the build and fix loop below matters more with small models.
- About 1 GB of free disk space for the SDK and build output.
- Optional: PowerShell 5.1 or 7 for the screenshot step.

## Inputs

| Input | Required | Example |
|---|---|---|
| Window description | Yes | "Inventory lookup: part number box, Search button, results grid, status bar" |
| Project name | No | `InventoryLookup` (default: derived from the description, PascalCase) |
| Pattern | No | `code-behind` (default) or `mvvm` |
| Output folder | No | A folder you choose. The skill asks before using a folder that already has files. |
| Target framework | No | `net8.0-windows` (default) |

## Step-by-step procedure

1. **Restate the window.** Write back a short list of the controls, their layout, and their behavior. Ask one question at a time only if something blocks the layout, for example "Should the grid be editable?" Otherwise pick a sensible default and say which default you picked.

2. **Pick the layout plan.** Map the description onto WPF panels:
   - Whole window: `Grid` with named rows and columns.
   - Toolbars and button rows: `StackPanel Orientation="Horizontal"` or `DockPanel`.
   - Forms: a two column `Grid` (labels in column 0, inputs in column 1).
   - Lists of records: `DataGrid` with `AutoGenerateColumns="False"` and explicit columns.

3. **Check the output folder.** If the folder exists and is not empty, list what is there and ask before writing. Never overwrite a file without a yes from the user.

4. **Create the project.**
   ```powershell
   dotnet new wpf -n InventoryLookup -o .\InventoryLookup --framework net8.0
   ```
   If the user chose an existing project, skip this step and edit only the files the change needs.

5. **Add the IOTA palette.** Create `Themes/Iota.xaml` and merge it in `App.xaml`.
   ```xml
   <!-- Themes/Iota.xaml -->
   <ResourceDictionary xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
                       xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
     <SolidColorBrush x:Key="Bg" Color="#050506"/>
     <SolidColorBrush x:Key="Surface" Color="#121212"/>
     <SolidColorBrush x:Key="Border" Color="#2A2A2A"/>
     <SolidColorBrush x:Key="Text" Color="#E0E0E0"/>
     <SolidColorBrush x:Key="Muted" Color="#9A9A9A"/>
     <SolidColorBrush x:Key="Accent" Color="#8EB8D4"/>

     <Style TargetType="Window">
       <Setter Property="Background" Value="{StaticResource Bg}"/>
       <Setter Property="Foreground" Value="{StaticResource Text}"/>
       <Setter Property="FontFamily" Value="Segoe UI"/>
       <Setter Property="FontSize" Value="14"/>
     </Style>
     <Style TargetType="TextBlock">
       <Setter Property="Foreground" Value="{StaticResource Text}"/>
     </Style>
     <Style TargetType="TextBox">
       <Setter Property="Background" Value="{StaticResource Surface}"/>
       <Setter Property="Foreground" Value="{StaticResource Text}"/>
       <Setter Property="BorderBrush" Value="{StaticResource Border}"/>
       <Setter Property="Padding" Value="8,6"/>
       <Setter Property="CaretBrush" Value="{StaticResource Text}"/>
     </Style>
     <Style TargetType="Button">
       <Setter Property="Background" Value="{StaticResource Surface}"/>
       <Setter Property="Foreground" Value="{StaticResource Text}"/>
       <Setter Property="BorderBrush" Value="{StaticResource Accent}"/>
       <Setter Property="Padding" Value="14,6"/>
       <Setter Property="Margin" Value="0,0,8,0"/>
     </Style>
   </ResourceDictionary>
   ```
   ```xml
   <!-- App.xaml (inside <Application.Resources>) -->
   <ResourceDictionary>
     <ResourceDictionary.MergedDictionaries>
       <ResourceDictionary Source="Themes/Iota.xaml"/>
     </ResourceDictionary.MergedDictionaries>
   </ResourceDictionary>
   ```
   Note: implicit `Style TargetType="Window"` does not apply to derived window classes, so also set `Background="{StaticResource Bg}"` on `MainWindow` directly.

6. **Write the XAML.** Use `x:Name` only on elements the code-behind touches. Example for the inventory window:
   ```xml
   <Window x:Class="InventoryLookup.MainWindow"
           xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
           xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
           Title="Inventory lookup" Width="900" Height="560"
           Background="{StaticResource Bg}" Foreground="{StaticResource Text}">
     <Grid Margin="16">
       <Grid.RowDefinitions>
         <RowDefinition Height="Auto"/>
         <RowDefinition Height="*"/>
         <RowDefinition Height="Auto"/>
       </Grid.RowDefinitions>
       <StackPanel Orientation="Horizontal" Margin="0,0,0,12">
         <TextBlock Text="Part number" VerticalAlignment="Center" Margin="0,0,8,0"/>
         <TextBox x:Name="PartBox" Width="220"/>
         <Button Content="Search" Margin="8,0,0,0" Click="Search_Click" IsDefault="True"/>
       </StackPanel>
       <DataGrid x:Name="Results" Grid.Row="1" AutoGenerateColumns="False" IsReadOnly="True"
                 Background="{StaticResource Surface}" Foreground="{StaticResource Text}" RowBackground="#121212" AlternatingRowBackground="#1A1A1A">
         <DataGrid.Columns>
           <DataGridTextColumn Header="Part" Binding="{Binding Part}" Width="*"/>
           <DataGridTextColumn Header="Description" Binding="{Binding Description}" Width="2*"/>
           <DataGridTextColumn Header="On hand" Binding="{Binding OnHand}" Width="Auto"/>
         </DataGrid.Columns>
       </DataGrid>
       <TextBlock x:Name="Status" Grid.Row="2" Margin="0,10,0,0" Foreground="{StaticResource Muted}" Text="Ready"/>
     </Grid>
   </Window>
   ```

7. **Write the behavior.**

   *Code-behind (default):*
   ```csharp
   using System.Collections.Generic;
   using System.Linq;
   using System.Windows;

   namespace InventoryLookup;

   public record Item(string Part, string Description, int OnHand);

   public partial class MainWindow : Window
   {
       private readonly List<Item> _items = new()
       {
           new("A-100", "Hex bolt, 10 mm", 240),
           new("A-101", "Washer, 10 mm", 1200),
           new("B-200", "Bracket, steel", 35),
       };

       public MainWindow() => InitializeComponent();

       private void Search_Click(object sender, RoutedEventArgs e)
       {
           var q = PartBox.Text.Trim();
           var hits = _items.Where(i => i.Part.Contains(q, System.StringComparison.OrdinalIgnoreCase)).ToList();
           Results.ItemsSource = hits;
           Status.Text = hits.Count == 0 ? "No matches" : $"{hits.Count} match(es)";
       }
   }
   ```

   *MVVM option:* add `CommunityToolkit.Mvvm` only if the package is already in the local NuGet cache or the user agrees to download it. Without it, use this minimal base:
   ```csharp
   using System;
   using System.ComponentModel;
   using System.Runtime.CompilerServices;
   using System.Windows.Input;

   public abstract class ViewModelBase : INotifyPropertyChanged
   {
       public event PropertyChangedEventHandler? PropertyChanged;
       protected bool Set<T>(ref T field, T value, [CallerMemberName] string? name = null)
       {
           if (Equals(field, value)) return false;
           field = value;
           PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
           return true;
       }
   }

   public sealed class RelayCommand : ICommand
   {
       private readonly Action _run; private readonly Func<bool>? _can;
       public RelayCommand(Action run, Func<bool>? can = null) { _run = run; _can = can; }
       public event EventHandler? CanExecuteChanged
       {
           add => CommandManager.RequerySuggested += value;
           remove => CommandManager.RequerySuggested -= value;
       }
       public bool CanExecute(object? p) => _can?.Invoke() ?? true;
       public void Execute(object? p) => _run();
   }
   ```
   Then bind with `Text="{Binding PartNumber, UpdateSourceTrigger=PropertyChanged}"` and `Command="{Binding SearchCommand}"`, and set `DataContext = new MainViewModel();` in the window constructor.

8. **Build.**
   ```powershell
   dotnet build .\InventoryLookup\InventoryLookup.csproj -c Debug -nologo -v q
   ```
   If the build fails, read the first error, fix only the line it names, and rebuild. Stop after 5 attempts and show the remaining errors to the user (see /fix-build for the full loop).

9. **Run and screenshot.** Start the app, wait for the window, capture it, then close it.
   ```powershell
   $exe = Get-ChildItem .\InventoryLookup\bin\Debug -Recurse -Filter InventoryLookup.exe | Select-Object -First 1
   $p = Start-Process $exe.FullName -PassThru
   Start-Sleep -Seconds 3
   Add-Type -AssemblyName System.Windows.Forms, System.Drawing
   Add-Type @"
   using System; using System.Runtime.InteropServices;
   public static class Win { [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
     [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r); }
   "@
   $p.Refresh(); $r = New-Object Win+RECT
   [void][Win]::GetWindowRect($p.MainWindowHandle, [ref]$r)
   $bmp = New-Object System.Drawing.Bitmap ($r.R - $r.L), ($r.B - $r.T)
   $g = [System.Drawing.Graphics]::FromImage($bmp)
   $g.CopyFromScreen($r.L, $r.T, 0, 0, $bmp.Size)
   $bmp.Save("$PWD\wpf-preview.png"); $g.Dispose(); $bmp.Dispose()
   Stop-Process -Id $p.Id
   ```
   Show the screenshot in the chat. With display scaling above 100 percent the capture can be offset; if so, note it and ask the user to check the running window instead.

10. **Iterate.** For each change request, edit the smallest part of the XAML or C#, show the diff, rebuild, and take a new screenshot. Keep a short change list in the chat.

## Output format

- A project folder with `App.xaml`, `MainWindow.xaml`, `MainWindow.xaml.cs`, `Themes/Iota.xaml`, and for MVVM a `ViewModels` folder.
- A screenshot `wpf-preview.png` next to the project.
- A chat reply with: the control list, the build result, the screenshot, and the exact commands to build and run it again.

## Safety and confirmation rules

- Never overwrite or delete a file without asking first. When editing, show a diff.
- Ask before adding any NuGet package, because it may need a download.
- Do not run the built app with administrator rights.
- Do not send, upload, or post anything. The skill only writes files in the folder the user chose.

## Quality checks

Before replying, the skill checks that:
- `dotnet build` finished with 0 errors. Warnings are listed, not hidden.
- Every `Click` handler named in XAML exists in the code-behind, and every `x:Name` used in C# exists in XAML.
- Text contrast: foreground `#E0E0E0` on `#050506` or `#121212`. No dark text on dark backgrounds.
- The window opens at a size that fits a 1366 x 768 screen.
- No hard coded personal paths in the code.

## Examples

1. **Request:** "/wpf a unit converter: value box, from and to dropdowns, Convert button, result label."
   **Result:** A 480 x 260 window with a two column form, two `ComboBox` controls filled with mm, cm, m, in, ft, a converter in code-behind, a passing build, and a screenshot.

2. **Request:** "/wpf mvvm a task list with add, remove, and a done checkbox."
   **Result:** `MainViewModel` with an `ObservableCollection<TaskItem>`, `AddCommand` and `RemoveCommand`, a `ListBox` with a `DataTemplate` holding a `CheckBox` and `TextBlock`, and a passing build.

3. **Request:** "Make the results grid fill the window and put the status bar in accent color."
   **Result:** A two line diff in `MainWindow.xaml`, a rebuild, and a new screenshot.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `NETSDK1100` or WPF not found | Build on Windows with a `-windows` target framework, for example `net8.0-windows`. |
| `The name 'InitializeComponent' does not exist` | The `x:Class` in XAML must match the namespace and class in the `.cs` file. |
| `StaticResource` not found at runtime | The theme dictionary is not merged in `App.xaml`, or the key is misspelled. |
| Blank screenshot | The window opened slowly. Increase the wait to 5 seconds and retry. |
| Restore fails offline | A package reference needs the internet. Remove it or use the plain MVVM base above. |

## Limitations

- Small local models sometimes produce XAML that looks right but fails to build. The build loop catches this, but complex custom controls and animations may need several rounds.
- The screenshot step uses screen capture, so the window must be visible and not covered.
- The skill does not design icons or custom fonts.

## Changelog

- 1.0 (October 2026): First release. Code-behind and MVVM patterns, IOTA palette, build loop, screenshot step.
