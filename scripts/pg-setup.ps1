# One-off helper: connect to local Postgres using credentials from the repo .env
# and ensure the lumen role + database exist for the API. Never prints secrets.
$envFile = Join-Path (Join-Path $PSScriptRoot '..') '.env'

$config = @{}
foreach ($line in Get-Content $envFile) {
  if ($line -match '^\s*([A-Z0-9_]+)=(.*)$') {
    $value = $Matches[2].Trim().Trim('"').Trim("'")
    $config[$Matches[1]] = $value
  }
}

$user = $config['POSTGRES_USER']
$pass = $config['POSTGRES_PASSWORD']
$db   = $config['POSTGRES_DB']

if (-not $user -or -not $pass) {
  throw 'POSTGRES_USER / POSTGRES_PASSWORD not found in .env'
}

$psql = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'
$env:PGPASSWORD = $pass

Write-Host "Connecting as '$user' (password from .env, not shown)..."
& $psql -h 127.0.0.1 -U $user -d postgres -At -c "select 1;" | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Auth failed for user '$user'."
  $env:PGPASSWORD = $null
  exit 1
}
Write-Host "Connected. Role: $user"

Write-Host "Databases: "
& $psql -h 127.0.0.1 -U $user -d postgres -At -c "select datname from pg_database order by 1;"

$probe = & $psql -h 127.0.0.1 -U $user -d $db -At -c "select 1;" 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) {
  if ($probe -match 'does not exist') {
    & $psql -h 127.0.0.1 -U $user -d postgres -c "CREATE DATABASE $db;" | Out-Null
    Write-Host "Created database: $db"
  } else {
    Write-Host "Cannot connect to '$db': $probe"
    $env:PGPASSWORD = $null
    exit 1
  }
} else {
  Write-Host "Database '$db' already exists"
}

& $psql -h 127.0.0.1 -U $user -d $db -At -c "select 'connected to ' || current_database();"
$env:PGPASSWORD = $null
