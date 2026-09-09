# verify-plugin.ps1 — isolated verification of a local plugin (protocol step 5)
#
# Creates a throwaway profile in $DSH_HOME/profiles/verify-<random>, composes
# dsh-base + dsh-headless + the plugin under test, checks that the plugin row is
# composed, and optionally boots it against a real model call ("smoke").
#
# It never touches the profile you pass as -SourceProfile, and it deletes the
# throwaway profile at the end (pass -Keep to inspect it).
#
#   pwsh -File scripts/verify-plugin.ps1 -PluginDir <dir> -PluginName my-plugin
#   pwsh -File scripts/verify-plugin.ps1 -PluginDir <dir> -PluginName my-plugin -Smoke
#
# Exit codes: 0 verified, 1 verification failed, 2 bad arguments.

param(
  [Parameter(Mandatory = $true)][string]$PluginDir,
  [Parameter(Mandatory = $true)][string]$PluginName,
  [string]$SourceProfile = 'web-b',
  [string]$Task = 'Reply with exactly the word VERIFY-OK and nothing else.',
  [switch]$Smoke,
  [switch]$Keep
)

$ErrorActionPreference = 'Stop'
$dshHome = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $HOME '.dsh' }
$source = Join-Path $dshHome "profiles\$SourceProfile"
$profileName = 'verify-' + (-join ((1..6) | ForEach-Object { '0123456789abcdef'[(Get-Random -Maximum 16)] }))
$dst = Join-Path $dshHome "profiles\$profileName"

function Fail([string]$message) { Write-Host "VERIFY FAILED: $message"; exit 1 }

# `dsh` writes its reasoning to stderr, and PowerShell turns native stderr into a
# terminating error under $ErrorActionPreference='Stop'. Capture both streams and
# let the caller judge by exit code.
function Invoke-Dsh([string[]]$arguments) {
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $text = & dsh @arguments 2>&1 | Out-String
    $code = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previous
  }
  return @{ code = $code; text = $text }
}

if (-not (Test-Path $PluginDir)) { Write-Host "VERIFY FAILED: plugin dir not found: $PluginDir"; exit 2 }
if (-not (Test-Path (Join-Path $PluginDir 'package.json'))) { Write-Host "VERIFY FAILED: $PluginDir has no package.json"; exit 2 }
if (-not (Test-Path $source)) { Write-Host "VERIFY FAILED: source profile not found: $source"; exit 2 }

Write-Host "verify: profile $profileName (source $SourceProfile)"

try {
  # 1. compose an isolated profile shell, reusing the installed package graph
  New-Item -ItemType Directory -Path $dst -Force | Out-Null
  foreach ($f in @('cordis.yml', 'profile.yaml', 'pnpm-workspace.yaml')) {
    $from = Join-Path $source $f
    if (Test-Path $from) { Copy-Item $from (Join-Path $dst $f) -Force }
  }
  cmd /c mklink /J "$dst\node_modules" "$source\node_modules" | Out-Null

  # 2. place the plugin under test where the profile's resolution finds it
  $target = Join-Path $dst "node_modules\$PluginName"
  New-Item -ItemType Directory -Path $target -Force | Out-Null
  foreach ($entry in (Get-ChildItem $PluginDir -Force)) {
    if ($entry.Name -eq 'node_modules' -or $entry.Name -eq '.git') { continue }
    Copy-Item $entry.FullName (Join-Path $target $entry.Name) -Recurse -Force
  }

  $manifest = Get-Content (Join-Path $PluginDir 'package.json') -Raw | ConvertFrom-Json
  if ($manifest.name -ne $PluginName) {
    Fail "package.json name is '$($manifest.name)' but -PluginName is '$PluginName'; they must match"
  }
  if ($null -eq $manifest.dsh.bundle.patch) {
    Fail "package.json has no dsh.bundle.patch; it is not a mountable DSH bundle"
  }

  # 3. compose the profile: base + headless + the plugin row
  $pkg = [ordered]@{
    name         = "dsh-profile-$profileName"
    private      = $true
    dependencies = [ordered]@{ $PluginName = "file:./node_modules/$PluginName" }
    dsh          = @{ profile = @{ bundles = @('@deepseek-ai/dsh-base', '@deepseek-ai/dsh-headless', $PluginName) } }
  }
  [System.IO.File]::WriteAllText(
    (Join-Path $dst 'package.json'),
    ($pkg | ConvertTo-Json -Depth 10),
    (New-Object System.Text.UTF8Encoding($false))
  )
  Set-Content (Join-Path $dst 'cordis.patch.yml') '[]' -Encoding UTF8

  # 4. composition check: the composed tree must resolve and contain the row
  $dump = Invoke-Dsh @('--profile', $profileName, '--dump-config')
  if ($dump.code -ne 0) { Fail "compose failed:`n$($dump.text)" }
  if ($dump.text -notmatch [regex]::Escape($PluginName)) { Fail "the plugin row is absent from the composed tree`n$($dump.text)" }
  Write-Host 'verify: compose OK (row present, packages resolve)'

  # 5. activation check: a real boot. `--dump-config` does not activate rows, and
  #    a load-time throw aborts the whole plugin tree, so a boot is the only
  #    honest check for "it activates".
  if ($Smoke) {
    $run = Invoke-Dsh @('--profile', $profileName, $Task)
    if ($run.code -ne 0) { Fail "boot failed:`n$($run.text)" }
    if ($run.text -notmatch 'VERIFY-OK') { Fail "boot produced no VERIFY-OK marker:`n$($run.text)" }
    Write-Host 'verify: boot OK (profile loaded, agent answered)'
  } else {
    Write-Host 'verify: boot skipped (-Smoke to activate the profile for real)'
  }

  Write-Host "VERIFIED: $PluginName"
  exit 0
}
finally {
  if (-not $Keep -and (Test-Path $dst)) {
    $link = Join-Path $dst 'node_modules'
    if (Test-Path $link) { (Get-Item $link).Delete() }
    Remove-Item $dst -Recurse -Force -ErrorAction SilentlyContinue
  } elseif ($Keep) {
    Write-Host "verify: kept $dst for inspection"
  }
}
