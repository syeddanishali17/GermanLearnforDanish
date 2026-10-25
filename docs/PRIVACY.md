# Privacy and security rules

The repository is **public**. The app is private: one user, behind a login, not indexed.

## Not indexed, not tracked
- Every HTML page has `<meta name="robots" content="noindex, nofollow, noarchive">`; every response (static and API) sends `X-Robots-Tag: noindex, nofollow, noarchive`.
- `robots.txt` allows crawling so crawlers can see the noindex. There is no sitemap; `/sitemap*` returns 404.
- The app is not submitted to search engines or directories. Do not put the production URL in this repository.
- No analytics, tracking pixels, ads or fingerprinting. Cloudflare Web Analytics stays off. Workers Logs (`observability`) is off. Wrangler CLI telemetry is disabled on the dev machine.
- `preview_urls: false`: no per-version preview URLs. Cloudflare Free plan only.

## Headers (public/_headers for static files, worker/index.ts for /api)
`X-Content-Type-Options: nosniff` · `Referrer-Policy: no-referrer` · `X-Frame-Options: DENY` · `Cross-Origin-Opener-Policy: same-origin` ·
`Permissions-Policy: camera=(), geolocation=(), payment=(), microphone=(self)` (microphone stays available for speaking features) ·
CSP for the app: `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests`.
API responses: `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`, `Cache-Control: private, no-store`, no CORS headers.

## Authentication
- Every `/api/*` route except `health`, `auth/login`, `auth/logout` needs a valid session, checked in the Worker (not in React). `stats/gate` also accepts the read-only gate token, which opens nothing else. `worker/security.test.ts` lists every private route and asserts 401 without a session; add new routes there.
- Session cookie: random 256-bit token, `HttpOnly`, `Secure`, `SameSite=Strict`, 180-day expiry. Only its SHA-256 is stored in D1. JavaScript never sees it.
- Logout deletes the session row server-side, then the app clears its offline queue (after a last sync), the cached API responses and the in-memory query cache.
- Login: PBKDF2-SHA256 password hash in a Cloudflare secret, 5 failed attempts per 10 minutes, then 429.
- Cross-site writes are rejected (Origin / Sec-Fetch-Site check) on top of SameSite.

## Offline data
- The service worker caches a few study GET endpoints (`daily`, `review/queue`, `items`, `culture`, `stats/dashboard`, `missions`) for at most 3 days so the app opens offline. Never login, export, settings or conversations. Deleted on logout.
- Queued answers live in localStorage until synced; cleared on logout.
- No secrets in the service worker or the frontend bundle.

## Voice (when recording arrives in Phase 2)
- Record only after an explicit tap; never request the microphone on page load.
- Delete raw audio after transcription/scoring by default. Never store recordings in public storage or in Git.
- Transcripts are private user data (behind auth, in the export, never in Git).
- Any vendor that receives audio is documented in docs/vendors.md with its retention policy before use.
- The clips in `frontend/public/audio/` are synthetic speech of the public phrase content, generated locally. They contain no user data.

## Personal content (private overlay)
- The public phrase decks and conversations are generic ("Ich komme aus ...", "an der Uni"). Danish's own versions live in `data/private/overlay.json` (git-ignored): fields replaced by slug, merged into the Worker at build time on his machine.
- Audio for lines that exist only in the overlay is rendered into `frontend/public/audio-private/` (git-ignored) and served by the Worker only to a logged-in session (`/audio-private/*`), cached on the device under `ustad-audio-private` and deleted on logout.
- The real learner profile is stored only in D1 (Settings). `docs/learner_profile.md` is a generic template; a private copy sits in `.secrets/`.
- Deploy from Danish's PC so the overlay is included. A build without it (e.g. GitHub auto-deploy) silently ships the generic content.

## Never commit
`.env`, `.dev.vars`, `.secrets/`, `data/private/`, `frontend/public/audio-private/`, Cloudflare secrets, API keys/tokens, session values, databases, D1 exports, app exports, backups, voice recordings, transcripts, journal or life-fact data, screenshots showing secrets, cookies or private data. `.gitignore` covers these. Before each push: run the secret scan (`python scripts/secret_scan.py`). If a secret was ever committed, rotate it.
