# End-to-end check: API up, auth works, and the local Ollama boundary is healthy.
$ErrorActionPreference = 'Stop'
$base = 'http://127.0.0.1:4000'

# 1) Wait for the API
$deadline = (Get-Date).AddSeconds(45)
$health = $null
while ((Get-Date) -lt $deadline) {
  try {
    $health = (Invoke-WebRequest -UseBasicParsing -Uri "$base/health" -TimeoutSec 2).Content
    break
  } catch { Start-Sleep -Seconds 1 }
}
if (-not $health) { throw "API did not become healthy within 45s" }
Write-Host "GET /health -> $health"

# 2) Register a throwaway dev user (idempotent: register, fall back to login)
$cred = @{ email = 'dev+ollama@lumen.local'; password = 'Ollama-Dev-Passw0rd' }
$body = ($cred | ConvertTo-Json)
$reg = try {
  Invoke-WebRequest -UseBasicParsing -Uri "$base/v1/auth/register" -Method POST -Body $body -ContentType 'application/json' -TimeoutSec 10
} catch {
  Write-Host "Register: $($_.Exception.Response.StatusCode) (likely already exists) -> trying login"
  Invoke-WebRequest -UseBasicParsing -Uri "$base/v1/auth/login" -Method POST -Body $body -ContentType 'application/json' -TimeoutSec 10
}
$regJson = $reg.Content | ConvertFrom-Json
$token = $regJson.tokens.accessToken
if (-not $token) { throw "Could not obtain an access token" }
Write-Host "Auth OK (token length $([int]$token.Length))"

# 3) AI status
$ai = (Invoke-WebRequest -UseBasicParsing -Uri "$base/v1/ai/status" -Headers @{ Authorization = "Bearer $token" } -TimeoutSec 15).Content
Write-Host "GET /v1/ai/status -> $ai"
