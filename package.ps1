param(
    [string]$Version = "dev"
)

$ErrorActionPreference = "Stop"
$source = Join-Path $PSScriptRoot "extension"
$releaseDir = Join-Path $PSScriptRoot "dist\releases"
$staging = Join-Path $PSScriptRoot "dist\staging"
$archive = Join-Path $releaseDir "twenty-chrome-plugin-$Version.zip"

if (-not (Test-Path -LiteralPath (Join-Path $source "manifest.json"))) {
    throw "Canonical extension source was not found: $source"
}

New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
if (Test-Path -LiteralPath $staging) {
    Remove-Item -LiteralPath $staging -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $staging | Out-Null
Get-ChildItem -LiteralPath $source -Force | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $staging -Recurse -Force
}
if (Test-Path -LiteralPath $archive) {
    Remove-Item -LiteralPath $archive -Force
}
Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $archive -Force
Remove-Item -LiteralPath $staging -Recurse -Force
Write-Output $archive
