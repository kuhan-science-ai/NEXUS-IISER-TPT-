param([switch]$Tunnel)

$ErrorActionPreference = 'Stop'
$tokenPath = Join-Path $PSScriptRoot '.local-ai-token'

function Get-OrCreateToken {
  if (-not (Test-Path -LiteralPath $tokenPath)) {
    $bytes = [byte[]]::new(32)
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_') |
      Set-Content -LiteralPath $tokenPath -NoNewline
  }
  return (Get-Content -LiteralPath $tokenPath -Raw).Trim()
}

if ($Tunnel) {
  $cloudflaredCommand = Get-Command cloudflared -ErrorAction SilentlyContinue
  $cloudflared = if ($cloudflaredCommand) { $cloudflaredCommand.Source } else { $null }
  if (-not $cloudflared) {
    $cloudflared = Join-Path $env:LOCALAPPDATA 'Programs\cloudflared\cloudflared.exe'
  }
  if (-not (Test-Path -LiteralPath $cloudflared)) {
    throw 'cloudflared is missing. Install it with: winget install --id Cloudflare.cloudflared --exact'
  }
  $token = Get-OrCreateToken
  Write-Host "Proxy token file: $tokenPath"
  Write-Host 'Configure the deployed Worker secret OLLAMA_API_KEY with the contents of this file.'
  Write-Host 'Run from nexus-backend in a separate terminal: npx wrangler secret put OLLAMA_API_KEY'
  Write-Host 'Then configure OLLAMA_BASE_URL with the HTTPS hostname printed by cloudflared.'
  & $cloudflared tunnel --url http://127.0.0.1:18787
  exit $LASTEXITCODE
}

$env:NEXUS_LOCAL_AI_TOKEN = Get-OrCreateToken
$env:NEXUS_OLLAMA_URL = 'http://127.0.0.1:11434/api/chat'
$env:NEXUS_LOCAL_AI_PORT = '18787'
$env:OLLAMA_NUM_PARALLEL = '2'
$env:OLLAMA_MAX_LOADED_MODELS = '1'
$env:OLLAMA_MAX_QUEUE = '512'
$env:OLLAMA_CONTEXT_LENGTH = '4096'
$env:OLLAMA_KEEP_ALIVE = '10m'

$ollama = Get-Command ollama -ErrorAction SilentlyContinue
if (-not $ollama) { throw 'Ollama is missing from PATH. Install Ollama and reopen PowerShell.' }

# Ollama reads concurrency settings only when its server starts. Restart the
# tray app/server so the limits below are applied to this local AI instance.
$runningOllama = Get-Process -Name 'ollama','ollama app' -ErrorAction SilentlyContinue
if ($runningOllama) {
  Write-Host 'Restarting Ollama with 2 parallel requests and a 512-request queue...'
  $runningOllama | Stop-Process -Force
  Start-Sleep -Seconds 2
}
Start-Process -FilePath $ollama.Source -ArgumentList 'serve' -WindowStyle Hidden

$ready = $false
for ($attempt = 0; $attempt -lt 60; $attempt++) {
  try {
    $health = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 2
    if ($null -ne $health.models) { $ready = $true; break }
  } catch { Start-Sleep -Seconds 1 }
}
if (-not $ready) { throw 'Ollama server did not become ready. Run `ollama serve` manually to inspect the startup error.' }

$models = @(& $ollama.Source list)
if (-not ($models | Select-String '^qwen3:14b\s')) {
  throw 'The downloaded qwen3:14b model was not found. Run `ollama pull qwen3:14b` and start this script again.'
}

Write-Host 'Starting the authenticated local AI proxy at http://127.0.0.1:18787'
Write-Host 'The unified Qwen3 14B assistant is available through the authenticated proxy and secure tunnel.'
Write-Host 'Ollama is configured for up to 2 simultaneous generations and a queue of up to 512 requests.'
Write-Host 'Requests beyond GPU capacity wait in the Ollama queue; 100 concurrent active generations are not guaranteed on one laptop GPU.'
Write-Host 'Per-request context is 4,096 tokens.'
Write-Host "Proxy token file: $tokenPath"
Write-Host 'Set the Cloudflare Worker OLLAMA_API_KEY secret to the contents of this file.'
Write-Host 'The token is local-only; do not paste it into chat or commit it.'
Write-Host 'In another terminal, start the secure tunnel with:'
Write-Host '  .\start-local-ai.ps1 -Tunnel'
Write-Host 'Then configure Worker secrets OLLAMA_BASE_URL and OLLAMA_API_KEY.'
python (Join-Path $PSScriptRoot 'local_ai_proxy.py')
