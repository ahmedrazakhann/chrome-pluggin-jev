param([switch]$Reload)
$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\.."))
. (Join-Path $root 'prod_server_management\load-env.ps1')
$envFile = Join-Path $root ".env"
if (Test-Path -LiteralPath $envFile) {
    Get-Content -LiteralPath $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#=]+?)\s*=\s*(.*)\s*$') { [Environment]::SetEnvironmentVariable($Matches[1].Trim(), $Matches[2].Trim()) }
    }
}
$port = if ($env:CHROME_PLUGIN_JEV_PORT) { $env:CHROME_PLUGIN_JEV_PORT } elseif ($env:CHROME_PLUGIN_PORT) { $env:CHROME_PLUGIN_PORT } else { "8110" }
$arguments = @("run", "--project", $PSScriptRoot, "uvicorn", "services.chrome_plugin_jev.src.app:app", "--app-dir", $root, "--host", "127.0.0.1", "--port", $port)
if ($Reload) { $arguments += "--reload" }
$uv = Get-Command uv -ErrorAction SilentlyContinue
if ($uv) { & $uv.Source @arguments }
else {
    $venvBin = if ($env:OS -eq 'Windows_NT') { 'Scripts' } else { 'bin' }
    $venvPython = if ($env:OS -eq 'Windows_NT') { 'python.exe' } else { 'python' }
    $python = Join-Path (Join-Path $root '.venv') (Join-Path $venvBin $venvPython)
    if (-not (Test-Path -LiteralPath $python)) { throw "Neither uv nor the project virtualenv Python was found." }
    $pythonArguments = @("-m", "uvicorn", "services.chrome_plugin_jev.src.app:app", "--app-dir", $root, "--host", "127.0.0.1", "--port", $port)
    if ($Reload) { $pythonArguments += "--reload" }
    & $python @pythonArguments
}

