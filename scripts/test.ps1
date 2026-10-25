$root = Split-Path -Parent $PSScriptRoot
Push-Location "$root\frontend"
npx tsc -b; $t = $LASTEXITCODE
npm run lint
npm run test; $f = $LASTEXITCODE
Pop-Location
if ($t -ne 0 -or $f -ne 0) { exit 1 }
