# Progress

## Status (25 Oct 2026)

| Phase | State |
|---|---|
| Spec review → v2.2 | Done. See docs/SPEC_REVIEW.md |
| 0. Scaffold | Done |
| 1a. Learning MVP (local) | Done |
| Content A1 → B1 | Done (see below) |
| v2.3 all-Cloudflare + natural voice | Done (see below) |
| Privacy & security hardening | Done (see below, docs/PRIVACY.md) |
| v2.4 Course, grammar, vocabulary, UI review | Done (see below) |
| v2.5 More grammar, word workout, grammar mix | Done (see below) |
| 1b. iPhone deploy | Deployed; iPhone acceptance test is Danish's |
| 2. Speaking MVP | Not started. Start in plan mode. Fill docs/vendors.md first |

## Phase 0 evidence
- Spec split into docs/spec/*.md (scripts/split_spec.py), plus docs/curriculum.md, docs/learner_profile.md, docs/vendors.md.
- Backend: FastAPI + SQLAlchemy 2 + Alembic (migration `phase 1 tables`), `GET /api/health`.
- Frontend: React 19 + Vite 8 + Tailwind 4 + TanStack Query + vite-plugin-pwa.
- `uv run pytest -q`: 15 passed. `npm run test`: 8 passed. `npm run build`: OK, service worker generated. ruff and oxlint clean.
- .env.example files, .gitignore (excludes .env, *.db, audio), Cloudflare Pages config in docs/DEPLOY.md.

## Phase 1a evidence
- Login (argon2, httpOnly cookie, 180 days, 5 failures / 10 min limit).
- Seed decks: 209 items (survival 85, vienna 43, uni 41, home 40), status `reviewed`, validated by `app.cli check-seed`.
- FSRS (py-fsrs 6, retention 0.90). New-card intake 6/day with backlog throttle. Sibling bury. Max 3 shows per card per session.
- Daily Sabaq: Manzil (unlock at 10 or all due) → Sabqi → Sabaq (hear, repeat, likely reply, recall, rate, roleplay) → Bolna (recall, expected reply, roleplay) → Bahar Mission (plan + log outcome).
- Culture phrase screen (use now / recognise now / later, region and register badges, sources).
- Browser TTS, de-AT preferred. Every audio item has visible text.
- Offline: service worker app shell + NetworkFirst cache of study data; answers queue in localStorage with UUID + timestamp, server dedupes and applies in time order.
- Report a problem on every card (flags item, removes it from intake/queue).
- Dashboard: study days, speaking minutes, real-world attempts, mature chunks, next target. Streak with 2 auto-freezes/week.
- Gate endpoint with read-only token. Export endpoint. Nightly SQLite backup job (prod).
- Manual run at 390px (in-app browser): logged in, completed a 6-chunk Sabaq with dialogues, Bolna, logged a Bahar Mission (counted as 1 real-world attempt), typed-answer review graded correctly. Screenshots: docs/evidence/.
- Bug found and fixed during the run: fsrs v6 starts new cards in Learning state, so sibling cards slipped past the bury rule. Covered by `test_siblings_buried_even_when_all_due`.

## Content expansion A1 → B1 evidence
- 31 full conversations (330 turns): A1 11, A2 12, B1 8. Files: data/conversations/{a1,a2,b1}.json. Each has setting, partner, goal, register, turns with acceptable alternatives, key phrases and Austria notes.
- Two new SRS decks: 5_smalltalk_a2.json (67 sentences, weeks 13 to 24), 6_b1_expression.json (61 sentences, weeks 25 to 36). Total now 337 items.
- New Talk tab: conversations by level, Listen / Roleplay / Your words modes, practice log, recommendation that follows the furthest week Danish has started. Today shows a Guftagu (conversation) block.
- Level tracking: item.cefr, conversation tables (Alembic migration `conversations and cefr`).
- Tests: backend 23 passed, frontend 10 passed (roleplay hides learner lines until said, logs practice). Checked in the browser at 390px.
- docs/curriculum.md extended with patterns P20 to P28 and the week 13 to 36 plan.

## v2.3: all on Cloudflare (free) + natural voice
- Why: Danish asked for a free backend with less setup, and reported the voice "reads letter by letter". Root cause of the voice problem: the device had no German voice (Windows here: only two English voices), so German was read by an English voice.
- Backend ported from Python/FastAPI to a Cloudflare Worker (Hono + ts-fsrs + D1). Same endpoints; item ids are now stable slugs. Content is bundled from data/*.json; D1 holds only user state (migrations/0001_init.sql). Python backend, Pages Function proxy and Dockerfile removed (in git history).
- Auth: PBKDF2-SHA256 (20k iterations, fits the 10 ms CPU budget), sessions hashed in D1, login rate limit in D1.
- Tests: 18 worker API tests on a node:sqlite D1 shim + 10 UI tests. Local dev runs the real Worker in workerd via @cloudflare/vite-plugin.
- Voice: tools/tts/generate.py renders every German line (phrases, replies, dialogues, conversations, alternatives) with Kokoro-82M German (Thorsten-Voice/Kokoro, Apache 2.0, CC0 voice data) on CPU, about 2 s per clip, mp3 48 kbps. The app plays these clips; device speech is only a fallback and only with a real German voice. Clips are cached offline on first play.

## Privacy & security hardening evidence
- noindex meta + `X-Robots-Tag` on every response, crawlable robots.txt, `/sitemap*` is 404, no analytics/trackers, Workers Logs off, preview URLs off, Wrangler telemetry off.
- Headers: nosniff, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, CSP with `frame-ancestors 'none'`, `Permissions-Policy: camera=(), geolocation=(), payment=(), microphone=(self)`. No getUserMedia anywhere yet.
- Server-side auth on every private route (worker/security.test.ts: 21 routes → 401), cross-site writes blocked, cookie HttpOnly + Secure + SameSite=Strict + 180-day expiry, logout deletes the session row; replaying the old cookie fails.
- Logout also syncs then clears the offline queue and the private API cache (verified in Edge: 2 cached entries → 0).
- Bug found and fixed: Cloudflare's `/index.html` → `/` redirect stopped the service worker from installing (offline mode never worked on the deployed site). `html_handling: "none"` fixes it; verified in Edge: SW active, app opens offline, audio plays, no CSP violations.
- `scripts/check_live.py <url>`: 35-point checklist (headers, noindex, robots, sitemap, auth, CORS, bundle secrets). `scripts/secret_scan.py`: history + staged + untracked scan.
- Tests: 54 (18 API, 26 security, 10 UI).

## v2.4: full course structure, more content, UI/UX review
- Kurs tab: 36 weeks A1 → B1 with goals, grammar, phrases, words and conversations per week, progress per week.
- 42 grammar lessons (P01–P42) with 210 drills (gap, tiles, transform), tracked accuracy (grammar_practice table, migration 0002), daily Qaida step.
- Core vocabulary: ~460 words in 26 topics. Total learnable items ~770. Conversations: 46.
- UI/UX review fixes: Continue button with the next best step; path-to-B1 progress; focus mode (no tab bar in lessons); audio plays on reveal and when moving to the next phrase; roleplay hint; Mission suggestions per place with meanings; More shows all decks, steppers, new-phrase limit up to 20; iPhone install guide (Login, Today, More); centred loading; theme-color for dark mode; 16 px inputs (no iOS zoom); article-aware grading (missing der/die/das = close, not correct).
- Bug fixed: newer Chrome returns a promise from window.scrollTo; returning it from a React effect blanked the app.
- Tests: 75+ (worker API, security, course content, drills, UI).

## Open items
- **Content check:** a native speaker (ideally Austrian) should skim data/seed/*.json and data/conversations/*.json and set good items to `approved`. Claude wrote and cross-checked them; that is not the same as a native review.
- **Not tested on a real iPhone yet** (Phase 1b): Add to Home Screen, login inside the installed app, speechSynthesis voice, offline review.
- Playwright is installed but browsers are not downloaded; no e2e suite yet.
- Voice is one male German (Germany) voice for every speaker. A second (female) voice for conversation partners and an Austrian voice are open improvements.
- Phase 1 "speaking minutes" counts time in Sabaq/Sabqi/Bolna screens (self-reported speaking). Phase 2 replaces this with recorded voice turns.

## Next session prompt
> Read CLAUDE.md and docs/PROGRESS.md, then help me do Phase 1b using docs/DEPLOY.md.

## v2.5 more grammar and vocabulary practice evidence
- 13 new grammar lessons (P43–P55, 8 drills each) in data/grammar/{a1b,a2b,b1b}.json, placed in curriculum weeks 2–34. 5 extra drills for each of P01–P42 (data/grammar/extra_drills.json). Total 55 lessons, 524 drills; drill order shuffles each round.
- Word workout (der/die/das, plurals, meaning both ways, hat/ist, typing) per week and mixed; daily Lughat step on Today; week page button with last accuracy.
- Grammar mix: 10 drills across lessons up to the current week, weakest first, stored per lesson.
- Routes: GET /api/vocab/:week, POST /api/vocab/:week/practice, GET /api/workout/grammar, POST /api/workout/grammar/practice (all private, in security.test.ts).
- `npm run test`: 83 passed. Manual run in the in-app browser at 375px: full word round, full grammar mix, results visible on Today and in /api/grammar.
- Found and fixed during the run: the label above a question gave away the answer on German → English picks; fake plurals put umlauts on -ung nouns.
- New drill sentences have no audio clip yet ("No audio for this line yet"); run tools/tts/generate.py to add them.

