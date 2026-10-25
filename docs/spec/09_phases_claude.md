<!-- Generated from SPEC.md by scripts/split_spec.py. Edit SPEC.md, then rerun. -->

## 13. Build phases (token-efficient)

**Session rules:** one phase per session; `/clear` between phases; read only the docs needed for the current phase; acceptance checks must be run and shown; update `PROGRESS.md`; commit after each phase.

| Phase | Goal | Done when |
|---|---|---|
| **0. Scaffold** | Repo, docs, tests, deploy skeleton | Split docs incl. new `curriculum.md`; backend/frontend start; health check; pytest/vitest pass; `.env.example`; gitignore; initial Cloudflare Pages config documented. |
| **1a. Learning MVP (local)** | Everything except accounts/deploy | Login; reviewed core seed decks (~200 total items); FSRS review; simplified Daily Sabaq; Culture Phrase card; Bahar Mission logging; listen/repeat audio for core phrases (browser TTS); screenshot at 390px; basic offline shell; Pages Function proxy; Dockerfile; deploy guide. |
| **1b. iPhone deploy** | Useful on Danish's phone immediately | Needs Danish's GitHub/Cloudflare/host accounts: backend deployed over HTTPS with a persistent volume; PWA on Cloudflare Pages; installed from Safari on the iPhone; the exact acceptance path below passes. |
| **2. Speaking MVP** | Complete the product's core purpose | Tap-start/tap-stop + hold-to-talk; STT → Tutor → TTS; `de-AT` voice when available and tested; phrase rehearsal; expected-reply training; micro-dialogue ladder; 8 practical Vienna roleplays; Live Prep; transcript confirmation; cost ledger; text fallback. |
| **3. Foundation grammar + Ghalti** | Make A1 sentence building reliable | Beginner pattern curriculum with prerequisites; sentence/question drills; cases/modals/separable verbs; simple Perfekt; writing 2–3×/week; Ghalti events/clusters; fix-sentence cards; A1 placement/checkpoint. |
| **4. Listening + reading** | Understand what people say back | Expected-reply listening; Vienna Ear; reader; short graded texts; TTS; dictation; ÖIF/ORF source page with safe link/embed handling. |
| **5. Life engine + adaptive curriculum** | Prepare for today's real situation | Morning situation check-in → 3 phrases + 2 likely replies; evening mission check-out; curriculum prioritises failed retrieval, recurring Ghalti and upcoming situations; notifications; optional finite feed. |
| **6. Tests, milestones, report card** | Accountability | Weekly functional test; monthly checkpoint; can-do milestones; optional A2 mock; report card; forecast; Builder gate. |
| **7. Later** | Only after sustained use | All-Cloudflare backend experiment (Python Workers/D1/R2) if worthwhile; realtime conversation mode; handwritten homework; calendar integration; B1 exam suite. |

**Phase 1 acceptance must include the exact iPhone path:** open the Cloudflare URL in Safari → Add to Home Screen → Open as Web App → complete one review and one Bahar Mission from the installed icon.

**Phase 2 acceptance must include one full beginner interaction on the real iPhone:** open from the Home Screen icon → hear a phrase → answer by voice → confirm the transcript → hear the tutor reply → use a repair phrase once → finish the session without an automatic turn cutoff.

**Token discipline:** keep the original rules: generators write files rather than dumping content into chat; use review subagents; record dependencies/reasons; compact context when needed.


## 14. CLAUDE.md starter (Claude Code creates this in Phase 0; keep < 80 lines)

```markdown
# Ustad: Danish's personal German speaking coach (single user)

Full spec: SPEC.md. Do not reread it in every session. Read docs/PROGRESS.md first, then only the docs for the current phase.

## Commands
- make dev · make test · make lint · make migrate
- backend: cd backend && uv run pytest -q
- frontend: cd frontend && npm run test

## Non-negotiables
- Danish is a beginner/A1 learner. Never assume B1 production ability.
- Speaking is the primary outcome. Every new lesson leads to spoken production.
- Teach likely replies, not only the learner's first sentence.
- Standard German first, Austrian/Vienna pragmatics as a clearly labelled layer.
- No speaking timer or automatic turn end in the default voice mode.
- Every audio item has visible text/transcript.
- All LLM output is validated structured JSON.
- Durable German learning content must be checked before entering SRS.
- API keys server-side only. Never commit .env, *.db or user audio.
- Every external API call writes to cost_ledger.
- Phone first: 390px target, one-handed UI. iPhone PWA acceptance is mandatory in Phase 1.
- Copy tone: short, direct, specific. No hype, no fake praise, no em dashes.
- Builder gate: before new feature work in Phase >=3, call GET /api/stats/gate. If study_days_last_7 < 5, bugs/content fixes only.

## Workflow
- One phase per session.
- Finish with acceptance checks + evidence, PROGRESS.md update and git commit.
- Use subagents for wide searches, vendor-doc checks and end-of-phase diff review.
```


## 15. Out of scope for v1

Native iOS/Android app; multi-user accounts; friends/leaderboards; points shops; heavy dialect training; realtime speech-to-speech; handwriting OCR; calendar sync; work-system integrations; large social feed; B1/B2 exam complexity before the A1/A2 speaking core works.


## 16. Open decisions and remaining uncertainty

| Item | Status / action |
|---|---|
| Cloudflare deployment | **Decision for v1:** frontend/PWA on Cloudflare Pages. Backend remains conventional FastAPI hosting unless Phase 7 proves an all-Cloudflare migration is worth it. |
| iPhone microphone/PWA | Must be tested on the real iPhone during Phase 1/2. HTTPS is mandatory. |
| `de-AT` speech quality | Azure currently exposes Austrian German speech capabilities/voices; Phase 2 must test actual STT/TTS quality with Danish before locking vendor/locale. |
| Austrian culture accuracy | High-value feature, but easy to get subtly wrong. Culture cards require source/manual verification and register labels. |
| Beginner curriculum | Create `docs/curriculum.md` in Phase 0 with pattern prerequisites and a 12-week speaking sequence. |
| Vendor/model prices | Re-check before wiring paid APIs. |
| STT on beginner/accented German | Test real samples and allow transcript confirmation. |
| Hosting backend | Choose the simplest host with HTTPS + persistent storage. Do not optimise infra prematurely. |
| Formal exam target | A2/B1 exam preparation remains optional until daily speaking behaviour is established. |
| Feature creep | The Builder gate starts after the speaking MVP (Phase 2) and is not optional. |
