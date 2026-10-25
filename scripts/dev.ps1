# Starts the app + API (Cloudflare Worker with local D1) on http://localhost:5173
$root = Split-Path -Parent $PSScriptRoot
Set-Location "$root\frontend"
npm run db:migrate:local
npm run dev
