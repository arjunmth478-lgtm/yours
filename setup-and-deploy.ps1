$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Write-Host '=========================================' -ForegroundColor Cyan
Write-Host ' SHOPNIX - AUTO DATABASE + DEPLOY' -ForegroundColor Cyan
Write-Host '=========================================' -ForegroundColor Cyan
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js is required. Install it from https://nodejs.org, then run this script again.' }
if (-not (Test-Path 'wrangler.toml')) { throw 'Extract the ZIP, open the shopnix-cloudflare folder in PowerShell, then run this script.' }
Write-Host 'Step 1/4: Sign in to your Cloudflare account. Approve the browser login.' -ForegroundColor Yellow
npx wrangler login
if ($LASTEXITCODE -ne 0) { throw 'Cloudflare login failed.' }
Write-Host 'Step 2/4: Automatically creating/finding the Shopnix D1 database...' -ForegroundColor Yellow
$dbId = $null
$listText = npx wrangler d1 list --json 2>$null | Out-String
if ($LASTEXITCODE -eq 0 -and $listText) {
  try {
    $dbList = $listText | ConvertFrom-Json
    $db = @($dbList | Where-Object { $_.name -eq 'shopnix-db' } | Select-Object -First 1)
    if ($db.Count -gt 0) { $dbId = [string]$db[0].uuid }
  } catch {}
}
if (-not $dbId) {
  $createText = npx wrangler d1 create shopnix-db 2>&1 | Out-String
  if ($LASTEXITCODE -eq 0) {
    if ($createText -match 'database_id\s*[:=]\s*["'']?([a-fA-F0-9-]{20,})') { $dbId = $Matches[1] }
    elseif ($createText -match '"database_id"\s*:\s*"([a-fA-F0-9-]{20,})"') { $dbId = $Matches[1] }
  } else {
    # Database may exist already; fetch it again and find its ID automatically.
    $listText = npx wrangler d1 list --json 2>$null | Out-String
    try { $dbList = $listText | ConvertFrom-Json; $db = @($dbList | Where-Object { $_.name -eq 'shopnix-db' } | Select-Object -First 1); if ($db.Count -gt 0) { $dbId = [string]$db[0].uuid } } catch {}
  }
}
if ($dbId -notmatch '^[a-fA-F0-9-]{20,}$') { throw 'Could not automatically obtain the Cloudflare D1 database ID. Check that you logged in to the correct Cloudflare account and rerun this script.' }
$toml = Get-Content 'wrangler.toml' -Raw
$toml = [regex]::Replace($toml, 'database_id\s*=\s*"[^"]+"', ('database_id = "' + $dbId + '"'))
Set-Content 'wrangler.toml' $toml -Encoding utf8
Write-Host 'Step 3/4: Creating tables and inserting starter products/settings...' -ForegroundColor Yellow
npx wrangler d1 migrations apply shopnix-db --remote
if ($LASTEXITCODE -ne 0) { throw 'Database migration failed; deployment stopped to avoid a broken website.' }
Write-Host 'Step 4/4: Deploying Shopnix website and backend...' -ForegroundColor Yellow
npx wrangler deploy
if ($LASTEXITCODE -ne 0) { throw 'Deployment failed. Read the error above, fix the reported issue, then run this script again.' }
Write-Host ''
Write-Host 'Shopnix deployment command completed. Open the workers.dev URL printed above.' -ForegroundColor Green
Write-Host 'Admin email: arjunmth2007@gmail.com' -ForegroundColor Cyan
Write-Host 'Admin password is set in src/worker.js. Keep your GitHub repository PRIVATE.' -ForegroundColor Yellow
