# Exposes the local Lumen API through Cloudflare Tunnel so a phone on another
# network can reach it. Native apps do not use CORS, but Android release builds
# require HTTPS, which the tunnel provides.
#
# Install cloudflared once:  winget install --id Cloudflare.cloudflared
#
# IMPORTANT: the QUICK tunnel URL below changes every restart. Because the URL is
# baked into the APK at build time, rebuild the app whenever it changes — or use
# a named tunnel with a stable hostname (see docs/mobile-release.md).

$ErrorActionPreference = 'Stop'

$port = if ($env:API_PORT) { $env:API_PORT } else { 4000 }

$cf = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cf) {
  Write-Host 'cloudflared is not installed.'
  Write-Host 'Install it with:  winget install --id Cloudflare.cloudflared'
  exit 1
}

Write-Host "Checking the API on http://localhost:$port ..."
try {
  Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:$port/health" -TimeoutSec 3 | Out-Null
  Write-Host 'API is healthy.'
} catch {
  Write-Host "WARNING: the API did not answer on port $port. Start it with 'npm run dev:api' first."
}

Write-Host ''
Write-Host "Starting a quick tunnel to http://localhost:$port ..."
Write-Host 'Copy the https://*.trycloudflare.com URL it prints, then set it as'
Write-Host 'EXPO_PUBLIC_API_URL before building the APK (apps/mobile/eas.json preview.env).'
Write-Host ''

& $cf.Source tunnel --url "http://localhost:$port"
