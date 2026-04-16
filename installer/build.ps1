<#
.SYNOPSIS
    Build the AI GM Assistant Windows installer.

.DESCRIPTION
    This script automates the full build process:
      1. Creates a clean Python virtual environment
      2. Installs project dependencies + PyInstaller
      3. Runs PyInstaller to create the standalone executable
      4. (Optional) Compiles the Inno Setup installer

    Run from the project root:
        .\installer\build.ps1

    To skip the Inno Setup step (just build the exe):
        .\installer\build.ps1 -SkipInstaller

.PARAMETER SkipInstaller
    If set, only build the PyInstaller bundle without creating the Inno Setup installer.
#>

param(
    [switch]$SkipInstaller
)

$ErrorActionPreference = 'Stop'

# Paths
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$InstallerDir = Join-Path $ProjectRoot 'installer'
$BuildDir = Join-Path $InstallerDir 'build'
$VenvDir = Join-Path $BuildDir 'venv'
$OutputDir = Join-Path $InstallerDir 'output'

Write-Host ''
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host '  AI GM Assistant - Windows Installer Builder' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ''

# -------------------------------------------------------------------
# Step 1: Clean previous build
# -------------------------------------------------------------------
Write-Host '[1/5] Cleaning previous build artifacts...' -ForegroundColor Yellow

if (Test-Path $BuildDir) {
    Remove-Item -Recurse -Force $BuildDir
}
New-Item -ItemType Directory -Force -Path $BuildDir | Out-Null

if (Test-Path $OutputDir) {
    Remove-Item -Recurse -Force $OutputDir
}
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

# -------------------------------------------------------------------
# Step 2: Create clean virtual environment
# -------------------------------------------------------------------
Write-Host '[2/5] Creating clean virtual environment...' -ForegroundColor Yellow

python -m venv $VenvDir
if ($LASTEXITCODE -ne 0) {
    Write-Host 'ERROR: Failed to create virtual environment. Is Python installed?' -ForegroundColor Red
    exit 1
}

$PipExe = Join-Path $VenvDir 'Scripts\pip.exe'
$PythonExe = Join-Path $VenvDir 'Scripts\python.exe'

# Upgrade pip
& $PipExe install --upgrade pip --quiet

# -------------------------------------------------------------------
# Step 3: Install dependencies
# -------------------------------------------------------------------
Write-Host '[3/5] Installing dependencies...' -ForegroundColor Yellow

$RequirementsFile = Join-Path $ProjectRoot 'requirements.txt'
& $PipExe install -r $RequirementsFile --quiet
if ($LASTEXITCODE -ne 0) {
    Write-Host 'ERROR: Failed to install project dependencies.' -ForegroundColor Red
    exit 1
}

& $PipExe install pyinstaller --quiet
if ($LASTEXITCODE -ne 0) {
    Write-Host 'ERROR: Failed to install PyInstaller.' -ForegroundColor Red
    exit 1
}

# -------------------------------------------------------------------
# Step 4: Run PyInstaller
# -------------------------------------------------------------------
Write-Host '[4/5] Building executable with PyInstaller...' -ForegroundColor Yellow
Write-Host '       This may take a few minutes...' -ForegroundColor DarkGray

$SpecFile = Join-Path $InstallerDir 'ai-gm-assistant.spec'
$PyInstallerExe = Join-Path $VenvDir 'Scripts\pyinstaller.exe'

& $PyInstallerExe `
    --distpath (Join-Path $BuildDir 'dist') `
    --workpath (Join-Path $BuildDir 'work') `
    --noconfirm `
    $SpecFile

if ($LASTEXITCODE -ne 0) {
    Write-Host 'ERROR: PyInstaller build failed.' -ForegroundColor Red
    exit 1
}

$DistDir = Join-Path $BuildDir 'dist\AIGMAssistant'
if (-not (Test-Path (Join-Path $DistDir 'AIGMAssistant.exe'))) {
    Write-Host "ERROR: Expected output not found at $DistDir" -ForegroundColor Red
    exit 1
}

Write-Host "  PyInstaller build complete: $DistDir" -ForegroundColor Green

# -------------------------------------------------------------------
# Step 5: Create installer with Inno Setup (optional)
# -------------------------------------------------------------------
if ($SkipInstaller) {
    Write-Host ''
    Write-Host '[5/5] Skipping Inno Setup (-SkipInstaller flag set)' -ForegroundColor DarkGray
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Green
    Write-Host '  BUILD COMPLETE' -ForegroundColor Green
    Write-Host "  Standalone app: $DistDir\AIGMAssistant.exe" -ForegroundColor Green
    Write-Host '============================================================' -ForegroundColor Green
    exit 0
}

Write-Host '[5/5] Creating Windows installer with Inno Setup...' -ForegroundColor Yellow

# Find Inno Setup compiler
$InnoCompiler = $null
$InnoSearchPaths = @(
    'C:\Program Files (x86)\Inno Setup 6\ISCC.exe',
    'C:\Program Files\Inno Setup 6\ISCC.exe',
    'C:\Program Files (x86)\Inno Setup 5\ISCC.exe',
    'C:\Program Files\Inno Setup 5\ISCC.exe'
)

foreach ($path in $InnoSearchPaths) {
    if (Test-Path $path) {
        $InnoCompiler = $path
        break
    }
}

# Also check PATH
if (-not $InnoCompiler) {
    $InnoCompiler = Get-Command 'ISCC.exe' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
}

if (-not $InnoCompiler) {
    Write-Host ''
    Write-Host 'WARNING: Inno Setup not found!' -ForegroundColor Yellow
    Write-Host '  The PyInstaller bundle was built successfully, but the' -ForegroundColor Yellow
    Write-Host '  Windows installer cannot be created without Inno Setup.' -ForegroundColor Yellow
    Write-Host ''
    Write-Host '  To install Inno Setup:' -ForegroundColor Cyan
    Write-Host '    1. Download from: https://jrsoftware.org/isdl.php' -ForegroundColor Cyan
    Write-Host '    2. Install it' -ForegroundColor Cyan
    Write-Host '    3. Re-run this script' -ForegroundColor Cyan
    Write-Host ''
    Write-Host '  Or, use the standalone executable directly:' -ForegroundColor Cyan
    Write-Host "    $DistDir\AIGMAssistant.exe" -ForegroundColor Cyan
    exit 0
}

$IssFile = Join-Path $InstallerDir 'setup.iss'
& $InnoCompiler $IssFile

if ($LASTEXITCODE -ne 0) {
    Write-Host 'ERROR: Inno Setup compilation failed.' -ForegroundColor Red
    exit 1
}

Write-Host ''
Write-Host '============================================================' -ForegroundColor Green
Write-Host '  BUILD COMPLETE' -ForegroundColor Green
Write-Host "  Installer: $OutputDir\AIGMAssistantSetup.exe" -ForegroundColor Green
Write-Host '============================================================' -ForegroundColor Green
