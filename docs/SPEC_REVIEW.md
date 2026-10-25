# Spec review: v2.1 → v2.2

Reviewed 25 Oct 2026. The v2.1 spec is strong on pedagogy and scope control. The problems were mostly in places where it would have broken on the iPhone, or where an implementer had to guess a number. Each item below is already applied to `SPEC.md`.

## Would have broken on the iPhone

1. **Cross-site session cookie.** v2.1 hosts the PWA on Cloudflare Pages and the API on another host, with an httpOnly cookie and CORS. Safari's tracking prevention blocks third-party cookies by default, so login would have worked on desktop Chrome and silently failed on the iPhone.
   **Fix:** a Cloudflare Pages Function proxies `/api/*` to the backend. The browser only ever talks to one origin. Auth moved under `/api/auth/*`.
2. **Recording format.** v2.1 says MediaRecorder → webm/opus. Safari records `audio/mp4` (AAC).
   **Fix:** feature-detect the format; backend accepts both.
3. **Hold-to-talk on iOS** opens the text-selection callout on long-press unless CSS and pointer events are set correctly. **Fix:** rule added to §5.4.
4. **Audio autoplay.** iOS only plays audio from a user gesture; an async tutor reply would be blocked. **Fix:** unlock an audio element on the turn-ending tap.
5. **Web push** needs iOS 16.4+ and only works from the Home Screen app. Noted in §6.3.
6. **Separate storage.** The installed web app does not share cookies with Safari. Danish logs in once inside the installed app; the cookie lasts 180 days.

## Numbers an implementer had to guess

7. **New-card intake** was unspecified. With ~200 items and no cap, day 1 could introduce everything. **Fix:** 6/day default, throttled by overdue backlog; review cap 100/day.
8. **Manzil unlock** required 10 due cards, but on day 1 nothing is due. **Fix:** "10 or all due".
9. **"Mature"** had no definition. **Fix:** chunk's production card stability ≥ 21 days (the Anki convention, adapted to FSRS). Counted per chunk, not per card.
10. **Card explosion.** Eight card types per chunk × 200 chunks = 1,600 cards. **Fix:** Phase 1 uses at most 3 per chunk (recognise, produce, reply) and buries siblings.
11. **Study day vs. streak.** "Daily Sabaq minimum" was never defined. **Fix:** a *minimum day* = Manzil unlock + one production answer (5–8 min). Daily-time targets in §1 and §4 now agree (18–25 min full loop).

## Quality and safety

12. **Learner name.** "Danish" is also a language. An LLM reading "help Danish speak German" or "explain in Danish's language" can misread it. **Fix:** every prompt states it is his first name.
13. **"Reviewed" seed decks** had no workflow. **Fix:** `draft → reviewed → approved | flagged`, plus a one-tap *Report a problem* on every card. The Phase 1 seed decks were written and cross-checked by Claude (status `reviewed`). A native speaker, ideally Austrian, should glance through `data/seed/` and move items to `approved`.
14. **Offline sync** was "sync safely". **Fix:** client UUID + client timestamp per answer; server applies in time order, deduplicates.
15. **Builder gate** lives in the production DB, but Claude Code runs locally. **Fix:** a read-only `X-Gate-Token` so `curl` can check it without the password.
16. **Login** on a public URL had no brute-force limit. **Fix:** 5 failures / 10 min.
17. **LanguageTool** needs 1–2 GB RAM, which rules out the cheapest hosts. **Fix:** optional, not before Phase 3.

## Simplifications

18. **`culture_phrase` merged into `item`.** A separate table would need its own SRS cards. Culture fields (register, region tag, learner action, likely reply, Austria note, mini-dialogue, verify source) are now nullable columns on `item`.
19. **Phase 1 audio** uses browser speech synthesis (`de-AT` → `de-DE`). No paid key is needed until Phase 2.
20. **Phase 1 split** into 1a (everything buildable locally, done) and 1b (deploy on Danish's own GitHub, Cloudflare and host accounts).
21. **No `make` on Windows.** The Makefile stays for Linux/macOS/CI; `scripts/*.ps1` do the same on Windows.

## Left as is, worth watching

- The milestone "500 mature chunks" is above the week-12 target of 300–450. That is fine as a later milestone.
- §17 sources were not re-verified in this review.
- Vendor choice for `de-AT` STT/TTS is still a Phase 2 test, not a decision.
