---
name: Windows Installer Packager
command: /package
version: "1.0"
category: Building apps
editions: both
editions_reason: "Works in both editions. Packaging runs local tools: the WiX Toolset for MSI, or the Windows SDK MakeAppx and SignTool for MSIX. Installing WiX as a .NET tool downloads it once; after that it works offline."
network: offline
network_note: "First install of the WiX .NET tool needs the internet. Timestamping a signature contacts a timestamp server, which you can skip."
author: "IOTA - Joseph Bryant"
license: "Free to use, copy, and adapt with credit to IOTA - Joseph Bryant. Provided as is, without warranty."
homepage: https://iotallc.github.io/skills/
---

# /package: Windows Installer Packager

Created by IOTA - Joseph Bryant. https://iotallc.github.io/

This file is a skill guide. It tells the model in IOTA how to do the job step by step. It is not a compiled program and it does not install anything. To use it, paste its text into an IOTA chat and then give your request, or read it and follow the steps yourself.

## Purpose

Turn a built Windows app into an installer people can double click: an MSI built with the WiX Toolset, or an MSIX package. The skill handles version numbers, Start menu shortcuts, upgrades, and code signing with a certificate you already have.

## When to use

- You built an app with /wpf or /scaffold and want to hand it to others.
- You need repeatable versioned installers for each release.
- Your organization requires signed installers.

## When not to use

- Publishing to the Microsoft Store (needs Partner Center steps the skill does not perform).
- Apps that need drivers, services with custom accounts, or complex prerequisites. The skill covers common cases only.
- When you do not have the right to distribute the app or its dependencies.

## Requirements

- A release build of the app, for example from:
  ```powershell
  dotnet publish .\src\PartTracker.App -c Release -r win-x64 --self-contained false -o .\publish
  ```
- MSI path: WiX Toolset v5 or later as a .NET tool: `dotnet tool install --global wix` (online once).
- MSIX path: Windows 10 SDK (`makeappx.exe`, `signtool.exe`), usually under `C:\Program Files (x86)\Windows Kits\10\bin\<version>\x64`.
- Signing: a code signing certificate in the user's certificate store or a `.pfx` file. The skill never creates or requests a commercial certificate.
- Model: any Gemma 3 or Nemotron size works; the templates are fixed and only names and versions change.

## Inputs

| Input | Required | Example |
|---|---|---|
| Publish folder | Yes | `.\publish` |
| Product name | Yes | `Part Tracker` |
| Manufacturer | Yes | your company name |
| Version | Yes | `1.2.0` |
| Format | No | `msi` (default) or `msix` |
| Main exe | No | detected if only one `.exe` |
| Certificate | No | thumbprint or `.pfx` path |

## Step-by-step procedure

1. **Check the version.** MSI versions use `major.minor.build` where major and minor are at most 255 and build is at most 65535. MSIX uses four parts `major.minor.build.revision`. Convert as needed and tell the user. Read the current version from the project if present:
   ```powershell
   [xml]$proj = Get-Content .\src\PartTracker.App\PartTracker.App.csproj
   $proj.Project.PropertyGroup.Version | Where-Object { $_ } | Select-Object -First 1
   ```

2. **Make or reuse the UpgradeCode.** The UpgradeCode must stay the same for every release of a product so upgrades replace older versions. Look for `installer/upgrade-code.txt`. If missing, generate one with `[guid]::NewGuid()` and save it there, and tell the user to keep that file in source control.

3. **MSI: write `installer/Product.wxs`.**
   ```xml
   <Wix xmlns="http://wixtoolset.org/schemas/v4/wxs">
     <Package Name="Part Tracker" Manufacturer="Example Co" Version="1.2.0"
              UpgradeCode="PUT-THE-SAVED-GUID-HERE" Scope="perMachine">
       <MajorUpgrade DowngradeErrorMessage="A newer version of [ProductName] is already installed." />
       <MediaTemplate EmbedCab="yes" />

       <StandardDirectory Id="ProgramFiles64Folder">
         <Directory Id="INSTALLFOLDER" Name="Part Tracker" />
       </StandardDirectory>
       <StandardDirectory Id="ProgramMenuFolder">
         <Directory Id="AppMenuFolder" Name="Part Tracker" />
       </StandardDirectory>

       <ComponentGroup Id="AppFiles" Directory="INSTALLFOLDER">
         <Files Include="..\publish\**" />
       </ComponentGroup>

       <Component Id="StartMenuShortcut" Directory="AppMenuFolder" Guid="*">
         <Shortcut Id="AppShortcut" Name="Part Tracker"
                   Target="[INSTALLFOLDER]PartTracker.App.exe" WorkingDirectory="INSTALLFOLDER" />
         <RemoveFolder Id="RemoveAppMenuFolder" On="uninstall" />
         <RegistryValue Root="HKCU" Key="Software\Example Co\Part Tracker"
                        Name="installed" Type="integer" Value="1" KeyPath="yes" />
       </Component>

       <Feature Id="Main">
         <ComponentGroupRef Id="AppFiles" />
         <ComponentRef Id="StartMenuShortcut" />
       </Feature>
     </Package>
   </Wix>
   ```
   Build:
   ```powershell
   wix build .\installer\Product.wxs -arch x64 -o ".\dist\PartTracker-1.2.0-x64.msi"
   ```
   The `Files` element harvests the publish folder at build time (added in WiX v5). If WiX v4 or older is installed, the skill says so and suggests upgrading instead of writing older syntax. The schema namespace stays `wixtoolset.org/schemas/v4/wxs` in v5 and later; that is expected.

4. **MSIX: write `msix/AppxManifest.xml`** and copy the publish folder plus logo images into a layout folder.
   ```xml
   <?xml version="1.0" encoding="utf-8"?>
   <Package xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
            xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
            xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"
            IgnorableNamespaces="uap rescap">
     <Identity Name="ExampleCo.PartTracker" Publisher="CN=Example Co" Version="1.2.0.0" ProcessorArchitecture="x64" />
     <Properties>
       <DisplayName>Part Tracker</DisplayName>
       <PublisherDisplayName>Example Co</PublisherDisplayName>
       <Logo>Assets\StoreLogo.png</Logo>
     </Properties>
     <Dependencies>
       <TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.17763.0" MaxVersionTested="10.0.22621.0" />
     </Dependencies>
     <Resources><Resource Language="en-us" /></Resources>
     <Applications>
       <Application Id="App" Executable="PartTracker.App.exe" EntryPoint="Windows.FullTrustApplication">
         <uap:VisualElements DisplayName="Part Tracker" Description="Part Tracker"
             BackgroundColor="transparent" Square150x150Logo="Assets\Square150x150Logo.png"
             Square44x44Logo="Assets\Square44x44Logo.png" />
       </Application>
     </Applications>
     <Capabilities><rescap:Capability Name="runFullTrust" /></Capabilities>
   </Package>
   ```
   The `Publisher` value must exactly match the subject of the signing certificate. Pack:
   ```powershell
   makeappx pack /d .\msix\layout /p ".\dist\PartTracker-1.2.0.0-x64.msix" /o
   ```
   The `/o` flag overwrites; the skill only uses it on files inside `dist` that it created in this run, and asks otherwise.

5. **Sign** (optional but recommended). With a certificate in the store:
   ```powershell
   signtool sign /fd SHA256 /sha1 <THUMBPRINT> /tr http://timestamp.digicert.com /td SHA256 ".\dist\PartTracker-1.2.0-x64.msi"
   ```
   With a `.pfx`, ask the user to type the password at the prompt (`/p` on the command line is visible in history, so prefer importing the pfx into the store first). Offline: leave out `/tr` and `/td` and warn that unsigned timestamps make the signature invalid when the certificate expires.

   For local testing only, a self signed certificate:
   ```powershell
   $cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject "CN=Example Co" -CertStoreLocation Cert:\CurrentUser\My
   ```
   Explain that other PCs will not trust it unless it is installed in their Trusted People store, so it is not for distribution.

6. **Verify.**
   ```powershell
   signtool verify /pa /v ".\dist\PartTracker-1.2.0-x64.msi"
   Get-FileHash ".\dist\PartTracker-1.2.0-x64.msi" -Algorithm SHA256
   ```
   Optionally do a test install in a VM or Windows Sandbox: `msiexec /i dist\PartTracker-1.2.0-x64.msi /l*v install.log`.

7. **Write release notes** `dist/RELEASE-1.2.0.txt` with version, file name, size, SHA-256, signing subject, and the build command.

## Output format

```
dist/
  PartTracker-1.2.0-x64.msi
  RELEASE-1.2.0.txt
installer/
  Product.wxs
  upgrade-code.txt
```

## Safety and confirmation rules

- Never overwrite an existing installer in `dist` without asking. Different versions get different file names.
- Never print or store certificate passwords. Never commit `.pfx` files; add `*.pfx` to `.gitignore`.
- Never change the UpgradeCode of an existing product without asking; doing so breaks upgrades.
- Test installs only with the user's go ahead. The skill does not upload or publish installers.

## Quality checks

- Version in the file name, the package, and the release notes all match.
- `signtool verify` passes when signed.
- The main exe exists in the publish folder and the shortcut target matches it.
- The SHA-256 in the notes matches `Get-FileHash`.

## Examples

1. `/package .\publish "Part Tracker" "Example Co" 1.2.0`: signed x64 MSI with a Start menu shortcut and release notes.
2. `/package msix ... 1.2.0`: converts to `1.2.0.0`, warns that the Publisher must match the certificate subject, produces a signed MSIX.
3. Upgrade test: building 1.2.1 with the same UpgradeCode replaces 1.2.0 on install.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `wix` not found | `dotnet tool install --global wix` and reopen the terminal. |
| MSIX install error 0x800B0109 | The certificate is not trusted on this PC. |
| MSIX error about Publisher | The manifest `Publisher` does not match the certificate subject. |
| Two copies after upgrade | The UpgradeCode changed or the version did not increase. |
| SmartScreen warning | New certificates need reputation; signing still helps. |

## Limitations

- WiX v3 and v4 syntax are not covered.
- No installer UI customization beyond the defaults.
- Prerequisite bundles (for example installing the .NET runtime) need a WiX Burn bundle, which is outside this guide; publishing self contained is the simpler option.

## Changelog

- 1.0 (October 2026): First release. WiX v5 MSI, MSIX manifest, signing, verification, release notes.
