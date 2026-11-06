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

$ollama = Get-Command ollama -ErrorAction SilentlyContinue
if (-not $ollama) { throw 'Ollama is missing from PATH. Install Ollama and reopen PowerShell.' }
$model = & $ollama.Source list | Select-String '^gpt-oss:20b\s'
if (-not $model) {
  throw 'GPT-OSS 20B is missing. Run: ollama pull gpt-oss:20b'
}

$health = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/tags' -TimeoutSec 5
if (-not $health.models) { throw 'Ollama is not running. Start Ollama, then run this script again.' }

Write-Host 'Starting the authenticated local AI proxy at http://127.0.0.1:18787'
Write-Host "Proxy token file: $tokenPath"
Write-Host 'Set the Cloudflare Worker OLLAMA_API_KEY secret to the contents of this file.'
Write-Host 'The token is local-only; do not paste it into chat or commit it.'
Write-Host 'In another terminal, start the secure tunnel with:'
Write-Host '  .\start-local-ai.ps1 -Tunnel'
Write-Host 'Then configure Worker secrets OLLAMA_BASE_URL and OLLAMA_API_KEY.'
python (Join-Path $PSScriptRoot 'local_ai_proxy.py')
