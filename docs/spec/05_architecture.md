<!-- Generated from SPEC.md by scripts/split_spec.py. Edit SPEC.md, then rerun. -->

## 8. Technical architecture

Chosen to keep the proven FastAPI + React stack while getting the app onto Danish's iPhone early.

### 8.1 Recommended v1 deployment

**Mahjong-like path for the phone:** GitHub → Cloudflare Pages → Safari → Add to Home Screen / Open as Web App.

Cloudflare Pages hosts the React/Vite PWA. The Python backend runs separately on a small PaaS or EU VPS with persistent storage.

**Same-origin API (v2.2):** the browser never calls the backend host directly. A Cloudflare Pages Function at `frontend/functions/api/[[path]].js` proxies `/api/*` to `BACKEND_ORIGIN`. Reasons: Safari's tracking prevention blocks cross-site cookies (a session cookie set by `api.other-host.com` for `ustad.pages.dev` would silently fail on the iPhone), CORS disappears, and the backend can move hosts without breaking the installed PWA. The proxy adds a shared `X-Proxy-Secret` header; in production the backend rejects requests without it. All routes, including auth, live under `/api/*`. This keeps the iPhone installation flow simple while preserving a conventional Python environment for SQLite, audio processing, background jobs and LanguageTool.

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + TypeScript + Vite + Tailwind + TanStack Query | phone-first, one-handed UI |
| PWA hosting | **Cloudflare Pages** | same workflow as the Mahjong app; automatic HTTPS and Git deploys |
| Backend | Python 3.12+, FastAPI, SQLAlchemy 2.x, Alembic, Pydantic v2 | flexible audio/NLP stack |
| Backend hosting | PaaS with persistent disk or small EU VPS | keeps SQLite, background jobs and LanguageTool practical |
| DB | SQLite WAL for v1 | single user, simple backup |
| Scheduler | `fsrs` | spaced repetition |
| Background jobs | APScheduler initially | nightly generation, reports, backups |
| PWA | `vite-plugin-pwa` | installable, offline shell + selected study content |
| Audio in | MediaRecorder | hold-to-talk + tap start/stop |
| Audio out | cached TTS mp3 | reuse and offline replay |
| Speech locale | prefer `de-AT` for TTS/STT where vendor support is good | Vienna listening exposure |
| NLP | LanguageTool self-hosted; spaCy if useful and host supports it | quality checks. LanguageTool needs ~1–2 GB RAM, so it is optional and not before Phase 3 |
| Tests | pytest, vitest, Playwright at representative iPhone widths | verification |

**Why not force everything onto Cloudflare Workers in v1:** Cloudflare supports FastAPI in Python Workers and D1 can provide SQLite-style serverless SQL, but Python Workers/package support is still evolving and the current design includes components such as LanguageTool and Python NLP/audio libraries. An all-Cloudflare version is a valid later migration, not a Phase 1 requirement.

### 8.2 iPhone requirements
- HTTPS before microphone work.
- Proper web-app manifest, `display: standalone`, 180×180 Apple touch icon and service worker.
- Test the exact Add to Home Screen flow on Danish's iPhone.
- 375–430 px layouts, large thumb targets, one-handed navigation.
- Voice recording must work from the installed web app, not only desktop Chrome.
- Offline: app shell + current SRS session + downloaded audio. Queue review answers locally and sync them safely when connectivity returns; server-required features show a clean offline state.
  - Sync rule: each queued answer carries a client UUID and the client timestamp. The server applies answers in timestamp order with `review_datetime` = client time and ignores UUIDs it has already seen.
- The Home Screen web app has its own storage, separate from Safari. Danish logs in once inside the installed app; the session cookie lasts 180 days.
- Phase 1 audio uses the browser's built-in speech synthesis (`speechSynthesis`, preferring `de-AT`, then `de-DE`), so Phase 1 needs no paid API key. Cached vendor TTS mp3s replace it in Phase 2.
- Restrict backend CORS to the deployed frontend origin(s). Prefer a stable API hostname so the installed PWA does not break when the backend is redeployed.

```text
ustad/
  SPEC.md  CLAUDE.md  Makefile  docker-compose.yml  .env.example
  docs/ (split spec + PROGRESS.md + vendors.md + curriculum.md)
  backend/app/{main.py, api/, core/, models/, srs/, llm/{prompts/}, voice/, content/, jobs/}
  backend/tests/
  frontend/src/{pages/, components/, features/{review,daily,voice,culture,missions,reader,progress}/, lib/}
  data/seed/  config/prices.yaml
```

API surface: `/auth/*`, `/api/daily`, `/api/review/*`, `/api/patterns/*`, `/api/drills/*`, `/api/voice/*`, `/api/culture/*`, `/api/missions/*`, `/api/mistakes`, `/api/texts/*`, `/api/tests/*`, `/api/stats/*`, `/api/life/*`, `/api/report/*`, `/api/costs`, `/api/export`.
