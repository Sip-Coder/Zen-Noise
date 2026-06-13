$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$ports = @(5000, 5180)

function Test-ZenNoiseServer {
  param([int] $Port)

  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/manifest.json" -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -eq 200 -and $response.Content -match '"name"\s*:\s*"Zen Noise"'
  } catch {
    return $false
  }
}

function Test-PortListening {
  param([int] $Port)

  return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

Set-Location -LiteralPath $repoRoot

if (-not (Test-Path -LiteralPath (Join-Path $repoRoot "node_modules"))) {
  Write-Host "Installing dependencies..."
  npm install
}

$selectedPort = $null
$serverAlreadyRunning = $false

foreach ($port in $ports) {
  if (Test-ZenNoiseServer -Port $port) {
    $selectedPort = $port
    $serverAlreadyRunning = $true
    break
  }

  if (-not (Test-PortListening -Port $port)) {
    $selectedPort = $port
    break
  }
}

if (-not $selectedPort) {
  throw "Ports $($ports -join ', ') are already in use. Stop one of those local servers and try again."
}

$url = "http://127.0.0.1:$selectedPort"

if (-not $serverAlreadyRunning) {
  $repoRootForCommand = $repoRoot.Path.Replace("'", "''")
  $command = "Set-Location -LiteralPath '$repoRootForCommand'; `$env:PORT='$selectedPort'; npm run dev"
  Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoExit", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $command) -WindowStyle Normal

  Write-Host "Starting Zen Noise on $url..."
  $deadline = (Get-Date).AddSeconds(45)
  do {
    Start-Sleep -Milliseconds 500
    if (Test-ZenNoiseServer -Port $selectedPort) {
      break
    }
  } while ((Get-Date) -lt $deadline)

  if (-not (Test-ZenNoiseServer -Port $selectedPort)) {
    throw "The local server did not respond on $url within 45 seconds."
  }
}

Write-Host "Opening $url"
Start-Process $url
