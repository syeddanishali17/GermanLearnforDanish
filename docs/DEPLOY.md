# Deploy (all on Cloudflare, free tier)

One Cloudflare Worker serves everything: the PWA files (Workers Static Assets), the API (`frontend/worker/`), and the data (D1, Cloudflare's SQLite). No server to maintain, one account, one command.

```
iPhone ──HTTPS──> ustad.<you>.workers.dev
                    ├─ /           static app + /audio clips (free, unlimited)
                    └─ /api/*      Worker (Hono) ──> D1 database "ustad"
```

Free-tier limits that matter (single user is far below all of them): 100,000 Worker requests/day, 10 ms CPU per request, D1 5 GB storage and 5 million row reads/day. Static asset requests are free and don't count.

## First deploy

From `ustad/frontend`:

```bash
npx wrangler login
```
Opens the browser; approve access to your Cloudflare account.

```bash
npx wrangler d1 create ustad
```
Copy the printed `database_id` into `wrangler.jsonc` (replace the zeros).

```bash
npm run password
```
Prints a generated password (keep it in your password manager) and its `PASSWORD_HASH`. To use your own: `npm run password -- "your own long password"`.

```bash
npx wrangler secret put PASSWORD_HASH
```
Paste the hash when asked. Optional, for the Builder gate: `npx wrangler secret put GATE_TOKEN` with any long random string.

```bash
npm run deploy
```
Builds the app, applies D1 migrations remotely, and deploys. It prints the URL, e.g. `https://ustad.<your-subdomain>.workers.dev`.

Check: `https://<url>/api/health` returns `{"ok":true,...}`.

## Updating
Deploy from this PC: the build merges your personal phrases from `data/private/` (git-ignored). `npm run deploy` again. Data in D1 is untouched; new migrations are applied automatically. New or changed phrases need audio first: `cd tools/tts && uv run python generate.py` (only missing clips are generated).

Not recommended: GitHub auto-deploy builds without `data/private/`, so it would replace your personal phrases with the generic ones. If you still want it: Cloudflare dashboard → Workers & Pages → ustad → Settings → Builds → connect a GitHub repo, so every push deploys (build command `npm run build`, deploy command `npx wrangler deploy`, root directory `frontend`). The D1 migration step then has to be run by hand when a new migration is added.

## Backups
D1 keeps point-in-time history (Time Travel) automatically. For your own copy: More → Export data in the app, or `npx wrangler d1 export ustad --remote --output ustad-backup.sql`.

## iPhone acceptance (SPEC §13)
1. Open the workers.dev URL in Safari.
2. Share → Add to Home Screen → Open as Web App.
3. Open Ustad from the Home Screen icon and log in (the installed app has its own cookie jar).
4. Complete one review (Manzil or Sabaq), play a few phrases, and log one Bahar Mission.
5. Flight mode on, open the app, answer a card and play a phrase you already heard, flight mode off. More → "Answers waiting to sync" returns to 0.

## Builder gate from Claude Code
```bash
curl -s -H "X-Gate-Token: $GATE_TOKEN" https://<url>/api/stats/gate
```

## Local development
```bash
cd frontend
cp .dev.vars.example .dev.vars   # then put a hash from `npm run password` in it
npm run db:migrate:local
npm run dev                      # app + API + local D1 on http://localhost:5173
```
