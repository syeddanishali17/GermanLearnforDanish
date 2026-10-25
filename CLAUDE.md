# Ustad: Danish's personal German speaking coach (single user)

Full spec: SPEC.md (v2.3). Do not reread it every session. Read docs/PROGRESS.md first, then only the docs/spec/*.md files for the current phase. After editing SPEC.md run `python scripts/split_spec.py`.

## Stack (v2.3: all on Cloudflare, free tier)
- One Cloudflare Worker: React PWA as static assets + API in `frontend/worker/` (Hono) + D1 database.
- Learning content is bundled from `data/seed/*.json` (phrases) and `data/conversations/*.json` (generic, public) plus `data/private/overlay.json` (Danish's personal versions, git-ignored, merged by slug at build). D1 holds only user state. Never move personal details into the public files.
- Audio: pre-generated clips in `frontend/public/audio/` from `tools/tts/generate.py` (Kokoro, Thorsten German voice, open source). Browser speech is only a fallback and only with a real German voice.

## Commands (from frontend/)
- `npm run dev`: app + API + local D1 on :5173 (run `npm run db:migrate:local` once first)
- `npm run test`: worker API tests (node:sqlite D1 shim) + UI tests · `npx tsc -b` · `npm run lint`
- `npm run deploy`: build, apply D1 migrations remotely, `wrangler deploy` (see docs/DEPLOY.md)
- `npm run password`: generate a password and its PASSWORD_HASH
- New phrases need audio: `cd tools/tts && uv run python generate.py` (only missing clips; overlay-only lines go to the login-only `public/audio-private/`)
- Schema change: add `frontend/migrations/000N_name.sql`; never edit applied migrations.

## Layout
- frontend/worker: index.ts (routes), srs.ts (ts-fsrs, intake, queue), progress.ts (day log, streak, dashboard), talk.ts (levels, conversations), content.ts (bundled JSON + validation), auth.ts, clock.ts (Vienna study days)
- frontend/src: pages/, components/, lib/ (api, outbox = offline answer queue, grade, speech = clip player, activity)

## Non-negotiables
- "Danish" is the learner's first name, not the Danish language. Say so in every LLM prompt.
- Danish is a beginner/A1 learner. Never assume B1 production ability.
- Speaking is the primary outcome. Every new lesson leads to spoken production.
- Teach likely replies, not only the learner's first sentence.
- Standard German first, Austrian/Vienna pragmatics as a clearly labelled layer.
- No speaking timer or automatic turn end in the default voice mode.
- Every audio item has visible text/transcript. Never read German with a non-German voice.
- All LLM output is validated structured JSON.
- Durable German learning content must be checked before entering SRS (status reviewed/approved).
- PUBLIC repo, private app: follow docs/PRIVACY.md. Never commit secrets, databases, exports, backups, recordings, transcripts or personal data; never put the production URL in the repo. Run `python scripts/secret_scan.py` before every push.
- noindex + security headers on every response; no analytics, trackers or telemetry. New private routes must be added to worker/security.test.ts.
- Microphone: request only after an explicit tap, never on load; delete raw audio after processing.
- Every external API call writes to cost_ledger.
- Workers Free: ~10 ms CPU per request. Keep handlers light; no heavy crypto or big loops.
- iPhone: Safari records audio/mp4, not webm. Playback must start inside a tap.
- Phone first: 390px target, one-handed UI.
- Copy tone: short, direct, specific. No hype, no fake praise, no em dashes.
- Builder gate: before new feature work in Phase >=3, `curl -H "X-Gate-Token: $GATE_TOKEN" https://<app>/api/stats/gate`. If not open, bugs/content fixes only.

## Workflow
- One phase per session.
- Finish with acceptance checks + evidence, PROGRESS.md update and git commit.
- Use subagents for wide searches, vendor-doc checks and end-of-phase diff review.
