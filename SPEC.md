# USTAD: Danish's personal German speaking coach (build spec for Claude Code)

Version 2.3 · 25 Oct 2026 · Owner: Danish (single user)

> **v2.3 changes:** the whole app now runs on Cloudflare's free tier (Worker + static assets + D1). The Python/FastAPI backend, Pages Function proxy and paid backend host are gone; the API is TypeScript (Hono + ts-fsrs) in `frontend/worker/`. Same-origin is now automatic. Audio is pre-generated with an open-source German voice (Kokoro, Thorsten) instead of device speech, because many devices have no German voice and read German with an English one. Content now reaches B1: 31 conversations and 337 phrases. §8 and §10 below still describe the v2.2 Python design; `CLAUDE.md` and `docs/DEPLOY.md` describe what is built.

> **v2.2 changes** (full reasoning in `docs/SPEC_REVIEW.md`): iPhone audio format fix (Safari records mp4/AAC, not webm), same-origin API via a Cloudflare Pages Function (Safari blocks cross-site cookies), explicit new-card intake and review caps, a defined "minimum day", a definition of *mature*, fewer card types per chunk in Phase 1, zero-cost browser TTS for Phase 1 audio, content review status + "report a problem", offline review sync rules, a read-only gate token, the learner-name ambiguity guard for LLM prompts, and Phase 1 split into 1a (local build) and 1b (deploy on Danish's accounts).

---

## 0. How to use this file (read first, Danish)

1. Make an empty folder `ustad/`, run `git init`, and put this file in it as `SPEC.md`. (Done: Phase 0 and Phase 1a are built. Continue from `docs/PROGRESS.md`.)
2. Start Claude Code in that folder and paste exactly:

   > Read SPEC.md fully. Do Phase 0 only (section 13). Stop when Phase 0's acceptance checks pass and show me the evidence.

3. After each phase: run `/clear`, then: `Read CLAUDE.md and docs/PROGRESS.md, then do Phase N.` One phase per session. Phase 0 splits this long spec into smaller `docs/` files so later sessions stay focused.
4. Use plan mode at the start of Phase 2 (voice) and Phase 5 (adaptive curriculum/LLM wiring).
5. If Claude Code goes wrong twice on the same thing: `/clear` and re-prompt with what you learned.

**Hard rule:** Ustad is a German-learning tool, not a coding hobby. Phase 1 must be usable on Danish's iPhone, and Phase 2 completes the core speaking MVP. From Phase 3 onward, no new feature phase starts unless the dashboard shows at least **5 study days in the previous 7**. Bug fixes are always allowed.

---

## 1. Mission and success metrics

**Mission:** take Danish from beginner/A1 German to **comfortable basic conversation with people in Vienna**, then to A2 and B1. The first priority is not exam technique. It is being able to greet people, understand the likely reply, ask and answer simple questions, and keep a short conversation going without immediately switching to English.

**Learning philosophy:** whatever Danish learns should become something he can **say to a real person that day**. Ustad teaches Standard German first, with a Vienna/Austria layer for common greetings, food and social phrases, everyday vocabulary, register, and cultural usage.

**North-star metric:** successful *active speaking* in German, especially real-world interactions, not minutes spent looking at the app.

| Metric | Target by week 12 |
|---|---|
| Study days | ≥ 5 of 7 per week |
| Daily active time | 18–25 min most days (full loop); 5–8 min minimum day counts |
| Ustad speaking practice | ≥ 45 min/week |
| Real-world German attempts | ≥ 5/week |
| 30–90 s basic conversations | ≥ 2/week by week 8; ≥ 3/week by week 12 |
| Mature high-frequency chunks | 300–450 |
| A1 foundation patterns | ≥ 85 % on recent production drills |
| Functional A1 check | ≥ 80 % across practical can-do scenarios; beginning A2 content is a bonus, not a deadline |

A "real-world attempt" can be as small as saying *Guten Appetit*, responding *Danke, gleichfalls*, asking *Ist hier frei?*, or using one repair phrase instead of immediately switching to English. The app rewards **attempt + comprehension + recovery**, not accent perfection. A successful interaction means Danish communicated the intended message and understood enough of the reply to respond, clarify, or recover. English support is allowed during learning; the goal is to reduce dependence on it gradually, not ban it artificially.

---

## 2. The learner (this becomes `docs/learner_profile.md` and is fed to every LLM call)

Keep this file editable from the app's Settings page. The tutor reads it every time.

- **Name:** Danish. (This is his first name, not the Danish language. Every LLM prompt must say so explicitly.) Lives in Vienna, Austria, and is a university student. (Personal details live only in the app's Settings, never in this public repo.)
- **German baseline:** beginner/A1. He knows scattered everyday words and phrases but cannot yet reliably build or sustain a basic conversation. Treat him as a beginner even if he recognises more vocabulary than he can produce.
- **Languages:** English is strong and is the default explanation language. German practice should gradually increase, but the tutor must never hide a simple explanation behind difficult German.
- **Study:** a university programme taught in English. Most university study is in English, so German is mainly for daily life, social integration, university interactions, and future working-student life in Austria.
- **Professional background/interests:** supply chain, logistics, operations, product work, technology, AI, engineering, and practical problem solving. Job/interview German can be introduced after basic daily German is stable.
- **Immediate speaking goals in Vienna:**
  - greet neighbours, classmates, staff and shop workers naturally;
  - use culturally normal phrases such as *Guten Appetit*, *Mahlzeit*, *Servus*, *Grüß Gott*, *Danke, gleichfalls* and *Passt* in the right context;
  - order food and coffee, shop, ask where something is, understand prices and numbers;
  - handle public transport, deliveries, dorm/repair issues and appointments;
  - introduce himself, say what he studies, where he lives and what he did at the weekend;
  - make small talk about university, weather, plans, food and Vienna;
  - ask for repetition or slower speech without abandoning German.
- **How he learns best:**
  - practical examples before long theory;
  - short, structured sessions with visible progress;
  - English explanation when a German pattern is genuinely new;
  - speaking immediately after learning a phrase;
  - repeated exposure to the reply a native speaker is likely to give;
  - clear correction, not vague encouragement.
- **Speaking UX:** user-controlled turn endings, no speaking timers by default, text always visible, and every audio item has a transcript. The app should make speaking feel low-friction for a beginner.
- **Accent target:** understandable Standard German. Prefer Austrian (`de-AT`) voices/listening examples when available, but do not demand an Austrian accent.
- **Style of feedback:** direct, specific and short. Like a strict but fair Ustad.

---

## 3. Pedagogy: what the app is built on

Each principle has a design rule. Evidence strength in brackets: STRONG = meta-analysis / well replicated, MOD = solid but limited, WEAK = small or company-reported, CONTESTED = researchers disagree. Sources in §17.

| # | Principle | Evidence | Design rule |
|---|---|---|---|
| P1 | **Test, don't reread.** Retrieval beats restudy for long-term recall. Roediger & Karpicke 2006: 61 % vs 40 % recall after one week. | STRONG | Every screen asks before it tells. Answer is hidden until Danish attempts. No "read the lesson again" button; there is "test me again". |
| P2 | **Spacing.** Optimal gap between reviews grows with how long you need to remember (Cepeda et al. 2006). | STRONG | FSRS scheduler (`fsrs` on PyPI v6.x or `ts-fsrs` v5.x, both MIT), desired retention **0.90** (library and Anki default; workload explodes above that). Do not hand-roll SM-2. |
| P3 | **Rote + understanding is not a contradiction.** The "paradox of the Asian learner": memorising and understanding work together (Watkins & Biggs 1996; Marton et al.; Kember 1996). Pure recitation without varied context does not transfer (Hifz studies show no general memory boost). | MOD / CONTESTED | Keep the traditional school repetition habit (recite, copy, dictation, tests) **but** every repetition of a chunk appears in a *new sentence* or context after day 1. Recitation is always followed by a use task. |
| P4 | **No cramming loops.** Overlearning helps at one week then fades fast (Rohrer et al. 2005). | MOD | Max 3 consecutive repetitions of the same card in a session; after that it goes back to the scheduler. |
| P5 | **Interleave confusables, block new vocab.** Interleaving overall g≈0.42 but for word learning blocking did better (Brunmair & Richter 2019). | CONTESTED for vocab | New chunk sets are learned in a block. Revision of confusables (der/die/das, Akk/Dat, weil vs denn vs deshalb) is interleaved. |
| P6 | **Prompts beat recasts.** Recasts (just restating correctly) rarely make learners self-correct; prompts (elicitation, metalinguistic clue) do (Lyster & Ranta 1997; Li 2010 meta-analysis: medium, lasting effect). | MOD–STRONG | Tutor correction is 2-step: first a **prompt** ("Check the verb position after *weil*"), Danish retries; only then the corrected sentence. In voice mode: max one prompt per turn, the rest go to the end-of-session review so conversation flow isn't broken. |
| P7 | **Output forces noticing** (Swain). | MOD | Every Sabaq ends with production (write or say), never only recognition. |
| P8 | **Comprehensible input** (Krashen): useful for reading/listening volume, but not enough alone; explicit grammar instruction helps. | CONTESTED | Graded texts at ~95–98 % known words (English-based coverage figures; German compounding makes them approximate) **plus** explicit grammar patterns. |
| P9 | **Chunks first.** Formulaic sequences are processed faster by learners and natives (Conklin & Schmitt 2008). | MOD | Unit of learning = chunk (§5.1). |
| P10 | **Shadowing.** Some listening gains, weak designs (Hamada 2014). | WEAK | Include as a mode, but don't build the curriculum around it. |
| P11 | **Short sessions** are justified by spacing research, not by "short attention spans". The "8-second attention span" is a myth with no underlying study. Heavy short-form video use *correlates* with worse attention (meta-analysis, r≈−0.38), causation not shown. | MOD | 3–10 min blocks with **hard stops**. The scroll feed (§5.10) is finite. |
| P12 | **Hours reality check.** Goethe-Institut estimates B1 = 260–490 hours of instruction from zero; B2 = 450–600. Danish starts as a beginner/A1 learner, so the app must prioritise high-frequency chunks, basic sentence patterns, listening to predictable replies, and repeated speaking practice. | Official estimate | Do not promise a fixed A2/B1 date. Forecast from Danish's actual active hours, real-world interaction frequency, and assessment results. |
| P13 | **Transfer to real conversation must be trained.** Knowing a phrase in an exercise is not the same as retrieving it with a person. | Design principle | Every new speaking chunk gets a micro-dialogue, an expected-reply exercise, and an optional same-day real-world mission. Track attempts without shaming failed or English-switched interactions. |
| P14 | **Speaking requires reply comprehension.** A learner who can start an interaction but cannot process the answer cannot sustain it. | Design principle | Teach the likely reply alongside the learner's phrase. Progress from slow/clear audio to normal conversational speed, then practise one repair move when the reply is unclear. |

---

## 4. The daily loop: Sabaq, Sabqi, Manzil

Borrowed from the classic South Asian memorisation structure (new lesson / recent revision / old revision), but redesigned around Danish's speaking goal. One Daily Sabaq is about 18–25 minutes and can be split across the day.

| Block | Urdu name in UI | What | Time |
|---|---|---|---|
| 1 | **Manzil** | Due SRS reviews, mostly high-frequency spoken chunks | 4–5 min |
| 2 | **Sabqi** | Recent phrases + yesterday's Ghalti items + likely replies | 3–4 min |
| 3 | **Sabaq** | One beginner micro-lesson: a sentence pattern, 5–8 chunks, or one tiny dialogue | 4–6 min |
| 4 | **Bolna** | Say, shadow and roleplay today's material | 6–8 min |
| 5 | **Bahar Mission** | One phrase or micro-conversation to try with a real person that day | outside app |
| 6 | **Homework** | Optional 2–4 sentence writing task, 2–3 days/week rather than every day | 2–4 min |

Rules:
- Revision comes first, but do **not** let review debt block the whole app. Complete at least 10 due cards (or all due cards if fewer are due) or 4 minutes of Manzil to unlock the Sabaq.
- **Minimum day** (counts as a study day and keeps the streak): Manzil unlock reached + at least one spoken or typed production answer. About 5–8 minutes. The full loop is the target, the minimum day is the floor.
- **New-card intake:** default 6 new chunks per day (setting, range 3–10). Intake drops to 3 when more than 60 reviews are overdue and stops when more than 120 are overdue. Daily review cap default 100; the rest carries forward oldest-first.
- Speaking happens every study day. A Daily Sabaq is not "complete" until Danish has produced at least one spoken or typed answer.
- Bahar Mission is deliberately small. Examples: say *Mahlzeit* in a canteen, ask *Ist hier frei?*, or answer *Danke, gleichfalls* naturally.
- If a native speaker replies and Danish does not understand, that is still useful data. The app asks what happened and teaches the likely reply.
- Missed day: carry review debt forward with a cap. No guilt language and no giant punishment session.

---

## 5. Modules

### 5.1 Vocabulary and chunks (SRS core)

- **Unit of learning = spoken chunk or micro-exchange, not isolated word.** Early examples: *Guten Morgen*, *Guten Appetit*, *Mahlzeit*, *Ist hier frei?*, *Mit Karte, bitte*, *Ich lerne noch Deutsch*, *Können Sie das bitte wiederholen?*
- Every important phrase stores: German, natural English meaning, audio, register (formal/informal/neutral), context, likely reply, Austria/Vienna note, and one mini-dialogue.
- Card types: DE→meaning recognition, EN→DE production, audio→meaning, expected-reply prediction, cloze, gender, plural and later verb forms.
- **Phase 1 card budget:** at most 3 cards per chunk: `recognise` (hear + read DE → meaning), `produce` (EN + context → say/type DE) and `reply` (only when the chunk has a likely reply: hear the reply → meaning). More card types multiply review load; add them only when a measured weakness justifies it.
- **Siblings:** only one card per chunk is shown per day. Introducing a chunk in the Sabaq counts as its first `produce` review; its sibling cards become due the next day.
- **Mature** = the chunk's `produce` card has FSRS stability ≥ 21 days. Dashboard counts mature chunks, not cards.
- **Content status:** every durable item is `draft` → `reviewed` → `approved` (or `flagged`). Only `reviewed`/`approved` items enter new-card intake. Every card has a one-tap "Report a problem" that flags the item for correction.
- Scheduler: FSRS. Typed answers can auto-grade, but spoken chunks can be marked from transcript/content match without scoring speed.
- **Gender cues:** der = ▲, die = ●, das = ■ everywhere nouns are shown.
- Seed decks for Phase 1, deliberately capped so the first release can be reviewed properly:
  1. **Survival German** (~80 chunks): greetings, politeness, repair phrases, numbers, food, shopping, directions and transport.
  2. **Vienna / Austria Culture** (~40 cards): *Servus, Grüß Gott, Mahlzeit, Passt, Sackerl, Semmel, Stiege, Jause* and similar high-value local language. Each card states whether Danish should **use now**, **recognise now**, or **learn later**.
  3. **University / Student Life** (~40 chunks): lecture rooms, timetables, classmates, canteen, asking questions, group work, library and administration.
  4. **Home & City Life** (~40 chunks): dorm, heating/repair, parcels, pharmacy, barber, restaurants and appointments.
- Expand these decks only after Danish has used the core set and the quality checks are working. The MVP should not ship hundreds of unreviewed generated phrases.
- Job and professional German comes later, after the basic everyday decks are stable.
- "Add from anywhere": tap any word or phrase in a text/dialogue to add it with its original context.

---

### 5.2 Grammar: patterns, recitation, drills

Grammar is taught as **small speaking patterns**, not as a 40-topic wall. Each pattern card has one rule, a slot diagram, 2–3 examples, one common mistake and immediate spoken production.

**Beginner priority order:**

1. Basic statements: subject + verb + rest; verb in position 2.
2. Yes/no questions and W-questions: *Kommst du...? Wo ist...? Wie viel kostet...?*
3. `sein`, `haben`, common regular verbs and the most useful irregular verbs in Präsens.
4. Articles and gender in useful chunks rather than abstract memorisation first.
5. Nominative vs accusative for everyday objects and requests.
6. Modal verbs: *kann, möchte, muss* + infinitive at end.
7. Separable verbs in daily routines: *aufstehen, einkaufen, anrufen*.
8. Dative in high-frequency phrases and common prepositions.
9. Perfekt for "what I did yesterday / at the weekend".
10. Connectors: first `und/aber/denn`, then `weil/dass/wenn`, then `deshalb/trotzdem`.
11. Polite requests with *könnte/könnten*, *hätte gern*, *würde gern*.
12. Relative clauses, passive and other B1 structures only after A2 foundations are functioning in speech.

**Recitation (Pahara):** limited to high-value tables and phrase frames: `sein`, `haben`, modal verbs, personal pronouns, article patterns, and question words. Recitation must immediately feed a speaking task.

**Drills:**
- build a sentence from tiles;
- transform a statement into a question;
- choose the phrase that fits the social context;
- complete the native speaker's likely reply;
- tense shift for simple routines/past weekend;
- error spotting;
- free production: one real sentence about Danish's current day.

---

### 5.3 Reading

Reading supports speaking rather than becoming the main activity.

- Early texts are **micro-dialogues** and short messages first, then 80–180 word graded texts.
- Topics: Vienna daily life, university life, transport, food, shopping, simple technology, student life, travel and practical situations.
- Austrian context should be visible, but grammar remains Standard German.
- Reader: tap word → gloss + gender + audio + add to SRS; long-press sentence → translation; unknown-word density; 2–3 comprehension questions.
- Every reading ends with **"Say 2 things from this text"** or a tiny roleplay.
- Add a "What would you actually say?" button that turns useful text sentences into spoken chunks.

---

### 5.4 Speaking: the voice tutor ("Ustad voice")

**Speaking is the primary module.** Architecture remains turn-based, not realtime, because the learner should control when a turn ends and the system needs transcripts, correction and low cost.

```text
[Browser/PWA] hold-to-talk OR tap-start/tap-stop → MediaRecorder (webm/opus)
     │ POST /api/voice/turn
     ▼
[FastAPI]  1. STT (prefer a model tested on Danish's German; language/locale de-AT or de)
           2. Pronunciation assessment for scripted shadowing only
           3. Tutor LLM
           4. TTS, prefer Austrian German voice (`de-AT`) where supported
     │ JSON {transcript, reply_text, reply_audio_url, corrections[], scores{}, expected_replies[]}
     ▼
[Browser/PWA] shows transcript, plays reply, lets Danish retry or continue
```

**Voice principles:**
- No auto-cutoff in the default mode. Danish explicitly ends his turn.
- **iPhone recording:** Safari's MediaRecorder produces `audio/mp4` (AAC), not webm/opus. Pick the format with `MediaRecorder.isTypeSupported()` and have the backend accept both (transcode with ffmpeg only if the STT vendor needs it).
- **iPhone touch:** hold-to-talk buttons need `user-select: none`, `-webkit-touch-callout: none` and pointer events (not mouse events), or iOS opens the text-selection callout mid-recording.
- **iPhone playback:** audio playback must start from a user gesture. Unlock one `<audio>` element on the tap that ends the turn, then reuse it for the tutor reply.
- No speaking timer by default.
- Do not score speed as "good German". Show pronunciation accuracy only when it helps intelligibility.
- Every reply has visible text and a replay button.
- If STT is uncertain, ask Danish to confirm the transcript rather than grading a bad transcription.
- Use `de-AT` TTS/listening voices when available so Vienna does not sound foreign to the app, while teaching neutral Standard German pronunciation.

**Speaking modes, in priority order:**
1. **Phrase rehearsal:** hear → read → repeat → hide text → say from memory.
2. **Expected reply:** Ustad says what a cashier/classmate/waiter is likely to say; Danish chooses or says the response.
3. **Micro-dialogue ladder:** one-turn exchange → two-turn exchange → four-turn exchange → 30–90 second conversation.
4. **Live Prep:** choose where Danish is about to go (Billa, canteen, university office, barber, café, U-Bahn help). Ustad gives 3 phrases and rehearses the likely interaction in under 3 minutes.
5. **Scenario roleplay:**
   - greeting a classmate before a lecture;
   - asking if a seat is free;
   - canteen: *Guten Appetit* / *Mahlzeit* and food questions;
   - supermarket and checkout;
   - ordering coffee/food;
   - asking for directions or a platform;
   - dorm/repair problem;
   - parcel or delivery;
   - barber;
   - pharmacy/doctor reception;
   - introducing himself at a student event;
   - simple working-student interview/small talk later.
6. **Free talk:** Danish's day, weekend, university or plans, kept at his current level.
7. **Say it better:** corrected version of his own sentence, then one-tap shadowing.

**Beginner recovery phrases must be overlearned:**
- *Entschuldigung, ich lerne noch Deutsch.*
- *Können Sie bitte langsamer sprechen?*
- *Können Sie das bitte wiederholen?*
- *Ich habe das nicht ganz verstanden.*
- *Was bedeutet ...?*
- *Wie sagt man ... auf Deutsch?*

These are not "failure phrases". They are conversation tools and should count as successful German use.

---

### 5.5 Listening (reading-first)

Listening is designed around **the reply Danish is likely to hear after he speaks**.

- Every new phrase can spawn an expected-reply listening card.
- Beginner flow: read transcript if needed → listen → identify meaning → reply aloud.
- Speed 0.75× / 1×, sentence-by-sentence replay and transcript toggle.
- Diktat: 3–5 short sentences, not necessarily daily at the beginning.
- Add **Vienna Ear** cards: Standard German plus common Austrian words/pronunciations, clearly labelled so the app does not pretend dialect is the only correct form.
- Commute mode later: 10–15 minute audio session built from today's phrases and yesterday's mistakes.
- External content should prioritise Austrian context where possible, including ÖIF materials and ORF simple-language content, while respecting licences and linking out when reuse is unclear.

---

### 5.6 Writing and homework (Kaam / Copy checking)

Writing is secondary to speaking in the first 12 weeks, but still supports grammar.

- Homework 2–3 times/week: 2–5 sentences tied to a speaking pattern.
- Tiny journal: "3 sentences about today".
- Practical writing: messages to classmates, dorm/repair notes, appointment messages and later simple professional emails.
- Red-pen correction: original, correction, one-line reason, error tag, score out of 10.
- Max 3 teaching points per correction.
- Useful errors feed the Ghalti Register and can create `fix_sentence` cards.
- LanguageTool pre-check before LLM grading where practical.

---

### 5.7 Ghalti Register (mistake notebook)

Every meaningful mistake from speaking, writing or drills lands here with: original, correction, tag, source, date, repetition count and whether the error blocked communication.

Views:
- recurring grammar errors;
- recurring pronunciation/intelligibility words;
- phrases Danish failed to retrieve in a real interaction;
- "I heard this but did not understand it" entries from Bahar Missions.

Recurring errors become Sabqi priority drills. The register should distinguish a one-off typo from a repeated spoken weakness.

---

### 5.8 Tests, exams, report cards

- **Weekly test:** 10–15 min, mostly spoken/functional at beginner level. Includes phrase retrieval, expected replies, one short listening task, one grammar pattern and one tiny writing task.
- **Monthly checkpoint:** measures speaking, listening, reading and writing separately, but speaking gets the largest visual emphasis on the dashboard.
- **A1/A2 practical checks:** "Can you do this?" scenarios such as introduce yourself, order food, ask a transport question, describe yesterday, arrange a simple plan.
- **Formal exam mode:** optional. Use Goethe/ÖIF-style practice later, but do not let exam format dictate the daily curriculum.
- **B1 board exam:** remains a later milestone after A2 conversational foundations are stable.
- **Report Card:** attendance, active minutes, mature chunks, speaking minutes, real-world attempts, conversation ladder level, top recurring errors and next week's 2–3 targets.

---

### 5.9 Life-context engine ("knows about me")

- Profile + life facts: university, Vienna routines, common places/tasks and upcoming situations Danish enters himself.
- **Morning check-in:** "Where are you likely to speak German today?" Chips: university, supermarket, canteen/café, transport, dorm, appointment, social, other.
- The app generates **3 phrases + 2 likely replies** for that situation.
- **Evening check-out:** "Did you use German with anyone?" Choices: no opportunity / tried one phrase / short exchange / conversation. Optional note: "What did they say back?"
- If Danish pastes the reply he heard, Ustad explains it and can add it to tomorrow's Sabqi.
- Privacy: no need to enter confidential employer or third-party details. Keep scenarios generic.

---

### 5.10 Scroll feed (doom-scroll replacement)

The feed is **later and optional**, not part of the first MVP. Speaking must not be displaced by easy tapping.

- 20–40 finite cards, mostly drawn from already-due SRS and Ghalti material.
- Cards: phrase recall, "what would they reply?", gender tap, micro-cloze, 5–10 s audio, Austria culture context choice.
- Feed cannot introduce a parallel curriculum.
- If the Daily Sabaq is incomplete, the home icon opens the Daily Sabaq, not the feed.

### 5.11 Austrian culture + real-world transfer

This is a first-class module, not decorative trivia. The goal is pragmatic competence: know what a phrase means, when it sounds natural, what may come back, and whether Danish should actively use it yet.

Each **Culture Phrase** stores:
- phrase;
- natural meaning, not just literal translation;
- context and time of day;
- formal / informal / neutral;
- common in Austria, common across DACH, Vienna-common, or mainly recognition-only;
- learner action: **use now / recognise now / later**;
- likely reply;
- one mini-dialogue;
- a "Use this today" mission.

Examples:
- **Guten Appetit!**: normal meal wish before eating.
- **Mahlzeit!**: common around lunchtime, especially in workplaces and canteens. Teach it for recognition early; active use should follow local context rather than becoming a default greeting.
- **Servus!**: informal hello/bye in Austria, useful with peers when the setting is clearly informal.
- **Hallo!**: a safe neutral default in many everyday Vienna interactions, especially with peers and in medium-formality settings.
- **Grüß Gott!**: a traditional polite Austrian greeting. Important to recognise; active use depends on setting, age and formality.
- **Danke, gleichfalls.**: "Thanks, same to you" for wishes such as *Schönen Tag noch*.
- **Passt.**: very common Austrian conversational "okay / works / that's fine".

Do not turn the course into dialect training. Danish should speak clear Standard German and progressively understand common Austrian usage.

---

## 6. Engagement and milestones (motivation design)

Evidence base remains self-determination theory, implementation intentions, habit formation and modest gamification effects. The product should make **using German outside the app** feel like progress.

### 6.1 Structure: classes, chapters, milestones
- Classes: **A1.1 → A1.2 → A2.1 → A2.2 → B1.1 → B1.2**. Placement can pre-fill parts of A1.
- Each chapter = 5–7 Sabaq + a short functional check.
- Milestones are can-do statements with evidence, for example:
  - "Said hello and goodbye naturally in 5 real interactions";
  - "Used *Guten Appetit* or *Mahlzeit* in the right context";
  - "Ordered food fully in German";
  - "Asked a stranger for directions and understood the key answer";
  - "Introduced yourself to a classmate for 30 seconds";
  - "Had a 2-minute basic conversation without switching immediately to English";
  - "500 mature high-frequency chunks".

### 6.2 Streak with honesty
- Streak = Daily Sabaq minimum completed.
- Two freezes/week can be auto-applied.
- Show weekly attendance beside the streak.
- Real-world attempts have a separate weekly counter. One unsuccessful attempt still counts as an attempt.

### 6.3 Notifications
- PWA web push after explicit permission. On iPhone this needs iOS 16.4+ and only works from the Home Screen web app, not from a Safari tab.
- Max 2/day.
- Prefer useful prompts: "You're heading to the canteen? Try: Mahlzeit!" or "Today: ask one person Ist hier frei?"
- Quiet hours 22:00–07:30 by default.

### 6.4 Rewards
- Informational feedback, not gems or leagues.
- Highlight transfer: "You used German with 4 people this week."
- Personal bests: longest Ustad conversation, most real-world attempts in a week, first no-English micro-conversation.

### 6.5 Accountability
- Weekly target set by Danish: study days, Ustad speaking minutes and real-world attempts.
- Report compares target vs actual.
- No shame language.

### 6.6 Builder gate
- Phase 2 is part of the core speaking MVP and is exempt from the gate.
- From Phase 3 onward, `/api/stats/gate` blocks new feature work if `study_days_last_7 < 5`. Bug fixes, content corrections and reliability work remain allowed.
- The gate endpoint accepts a read-only `X-Gate-Token` header (env `GATE_TOKEN`) so a Claude Code session can check it with `curl` without the login password. The token can read the gate and nothing else.

---

## 7. Progress tracking and reporting

**Tracked automatically where possible:**

| Measure | How computed |
|---|---|
| Active time | input/audio interaction time; idle > 60 s excluded |
| Study day | Daily Sabaq minimum done |
| Speaking | minutes, turns, phrases produced, retries |
| Conversation ladder | highest recently successful level: 1-turn / 2-turn / 4-turn / 30–90 s / 2+ min |
| Real-world attempts | Danish logs opportunity + attempt + whether reply was understood |
| Reply comprehension | expected-reply listening accuracy + mission follow-ups |
| Vocab | seen / learning / mature / known-from-placement |
| Grammar mastery | recent production accuracy per pattern |
| Errors | errors per 100 spoken/written words by tag |
| Listening | expected-reply + dictation/comprehension accuracy |
| Reading | texts and known-word density |
| Tests | weekly/monthly/formal module scores |
| Cost | € per day/month by vendor |

**Primary dashboard shows only:**
1. study days this week;
2. speaking minutes;
3. real-world German attempts;
4. mature chunks;
5. current top weakness / next target.

Everything else lives under Progress.

**Skill estimate:** show A1/A2/B1 bands with uncertainty, not fake precision.

**Forecast:** based on the last 4 weeks of actual active time and performance. Do not promise an exam date from calendar time alone.

**Weekly Report Card:** Sunday evening, grayscale A4/PDF, with a short "Ustad's remarks" section grounded in observed errors and real interactions.

---

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

---

## 9. LLM tutor design

**Roles:** one `app/llm/` provider interface so models can be swapped without changing pedagogy.

| Role | Used for | Output |
|---|---|---|
| Tutor | voice turns, hints, micro-dialogues, recovery help | structured JSON |
| Grader | writing, end-of-session voice review, weekly remarks | structured JSON |
| Author | lessons, culture cards, scenario cards, graded texts | structured JSON stored in DB |

Rules:
- All LLM output is structured JSON validated by Pydantic. One repair retry, then graceful fallback.
- Generate ahead where possible. Live generation is mainly Tutor/Grader.
- Generated German is checked before becoming durable SRS material.
- Beginner level control: short sentences, high-frequency vocabulary, one new grammar idea at a time.
- **Austrian pragmatics guard:** the Author must label local phrases by context/register and must not invent dialect claims. Culture cards should be checked against a trusted Austrian source or manually approved.
- Explanation language: English by default. German examples remain German.
- The tutor prioritises *successful interaction* over grammatical sophistication. For a beginner, a short usable sentence is better than a complex sentence he cannot retrieve outside the app.

**Tutor system prompt draft:**

```text
You are "Ustad", a strict but fair German speaking coach for one beginner learner who lives in Vienna.
The learner's first name is Danish. "Danish" is his name, not the Danish language: never reply in or about Danish the language.
Your main job is to help him use German with real people, starting from A1.

Rules:
- Speak German at his current level. For beginner turns, usually 1 short sentence + 1 question.
- Explain new grammar briefly in English when needed.
- Every lesson should lead to something he can say in Vienna today.
- Teach the likely reply too. Conversation is not just producing the first sentence.
- Prefer clear Standard German. Add Austrian/Vienna usage notes only when useful, with register/context.
- Never shame accent, hesitation, failed attempts or switching to English.
- Correct at most one thing during a live turn. Save the rest for review.
- If he is stuck, offer a rescue phrase or a smaller version of the sentence.
- Specific feedback only. No praise inflation.
- Output validated JSON.
```

**Tutor JSON should include:** `reply_de`, `reply_en_gloss`, `prompt_correction`, `errors`, `new_chunks`, `expected_replies`, `culture_note`, `mission_candidate`, `turn_goal_met`.

**Grader schema:** retain score, corrected text, tagged errors and max 3 teaching points.

---

## 10. Data model

SQLite for v1. All timestamps UTC, display Europe/Vienna.

| Table | Key fields |
|---|---|
| `profile` | id=1, name, level_band, explanation_lang, settings_json, gate_override |
| `life_fact` | id, category, text, valid_from, valid_to |
| `item` | id, kind, de, en, gender, plural, pos, lemma, tags, cefr, freq_rank, source, status |
| `card` | id, item_id, card_type, FSRS state |
| `review_log` | id, card_id, ts, rating, answer_given, elapsed_ms |
| `pattern` | id, code, title, rule_en, slot_diagram, prerequisites, order |
| `lesson` | id, date, type, scenario, items, status |
| `session` | id, kind, started, ended, active_s |
| `attempt` | id, session_id, task_type, task_ref, item_id?, pattern_id?, input, correct, error_tags, score, response_ms, hint_used, answer_mode |
| `error_event` | id, ts, source, orig, fix, tag, blocked_communication bool |
| `error_cluster` | id, tag, canonical_issue, occurrence_count, last_seen, priority |
| `culture_phrase` | v2.2: merged into `item` so culture cards use the same SRS cards. `item` gains: register, region_tag (standard/dach/austria/vienna/recognition), learner_action (use_now/recognise_now/later), context, likely_reply_de/en, austria_note, mini_dialogue_json, verify_source, deck, status (draft/reviewed/approved/flagged) |
| `real_world_mission` | id, date, phrase_ids, situation, status, outcome, reply_heard, understood_reply bool, notes |
| `micro_dialogue` | id, title, level, context, turns_json, culture_tags |
| `homework` | id, assigned, due, prompt, submission, grade_json, status |
| `text` | id, title, body_de, level, topic, known_density, source_url, licence, audio_asset_id? |
| `audio_asset` | id, path, kind, text_ref, voice, locale, duration_s |
| `voice_session` / `voice_turn` | session meta; transcript, reply, correction, pron_json, audio refs |
| `test` / `test_result` | type, module scores, items_json |
| `milestone` | code, title, achieved_at, evidence_ref |
| `day_log` | date, study_day, freeze_used, minutes, speaking_s, real_world_attempts |
| `report_card` | week, json, pdf_path |
| `cost_ledger` | ts, vendor, model, units, unit_type, eur |

Error tags should keep the original grammar taxonomy and add: `QUESTION_FORM`, `WORD_ORDER_BASIC`, `POLITENESS_REGISTER`, `REPLY_COMPREHENSION`, `RETRIEVAL_FAILURE`, `INTELLIGIBILITY`.

Avoid stuffing analytics-critical fields into JSON. JSON is fine for payloads that are rarely queried.

---

## 11. Content sources and licensing

Default rule: store only content whose licence clearly permits it. Otherwise link/embed and create Ustad's own exercises. Keep `source_url` and `licence` on stored content.

**Open/storable core:**
- Tatoeba German sentences where the applicable licence permits reuse, with attribution.
- Kaikki/Wiktextract for lemmas, gender, plurals and conjugations, with required attribution/share-alike handling.
- spaCy German model for local NLP where technically practical.
- self-hosted LanguageTool for German checks; do not automate against the public endpoint.
- Piper or another properly licensed local TTS fallback if later needed.

**Austria-first learning sources:**
- **ÖIF Sprachportal:** use as a major reference for A1–B2 Austria-focused exercises, listening and exam practice. Default to link/embed/reference unless the exact material licence explicitly allows copying into Ustad.
- **ORF Nachrichten in Einfacher Sprache:** useful later for Austrian listening/context; default to link out or embed according to applicable terms rather than copying transcripts.
- Austrian everyday vocabulary/culture cards should cite the source used to verify usage. University of Vienna and ÖAW material can be used to cross-check greeting/register notes; ÖIF should be preferred for beginner learning context.

**Other external sources:**
- DW learning materials and Nicos Weg: link where reuse rights are unclear.
- YouTube: official embed only; do not scrape captions/transcripts.
- Goethe word lists: local reference/coverage check only unless licence clearly allows deployment.
- News/public-sector sources: store only when their terms permit reproduction; otherwise link and generate companion vocabulary/questions.

**Rule for Austrian language:** do not treat one Vienna colloquialism as universal Austrian German. Label cards as `standard`, `Austria-common`, `Vienna-common`, or `recognition-only` and include register.

---

## 12. Privacy, security, cost control

**Security:**
- Single-user login with argon2 password hash + httpOnly secure session cookie (first-party thanks to the same-origin proxy).
- Login rate limit: 5 failed attempts per 10 minutes, then a cool-down.
- HTTPS mandatory before microphone use.
- API keys server-side only; never commit `.env`.
- Back up SQLite nightly to a second location.
- `/api/export` provides a full personal-data export.

**Privacy:**
- Delete raw user audio after STT/scoring by default. Optional short retention for self-review.
- Keep real-world mission notes minimal. Do not store names of strangers or unnecessary personal details.
- Before production voice use, document vendor retention/training policies in `docs/vendors.md`.
- Do not enter confidential employer, university assessment, or third-party private information into generated scenarios.

**Cost control:**
- Every external call writes to `cost_ledger`.
- Configurable daily soft cap and monthly hard cap.
- At hard cap, SRS, stored lessons, culture cards and offline content keep working. Voice/grading falls back cleanly rather than breaking the app.

---

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

---

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

---

## 15. Out of scope for v1

Native iOS/Android app; multi-user accounts; friends/leaderboards; points shops; heavy dialect training; realtime speech-to-speech; handwriting OCR; calendar sync; work-system integrations; large social feed; B1/B2 exam complexity before the A1/A2 speaking core works.

---

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

---

## 17. Sources

Original evidence/source set checked 20 Oct 2026; Austria/deployment additions checked 25 Oct 2026. Evidence tags as in §3.

**Learning science**
- Roediger & Karpicke 2006, testing effect: https://doi.org/10.1111/j.1467-9280.2006.01693.x
- Adesope et al. 2017, practice testing meta-analysis: https://journals.sagepub.com/doi/10.3102/0034654316689306
- Dunlosky et al. 2013, learning techniques: https://journals.sagepub.com/doi/10.1177/1529100612453266
- Cepeda et al. 2006, distributed practice: https://pubmed.ncbi.nlm.nih.gov/16719566/
- Brunmair & Richter 2019, interleaving meta-analysis: https://doi.org/10.1037/bul0000209
- Rohrer et al. 2005, overlearning: https://digitalcommons.usf.edu/psy_facpub/1772/
- FSRS libraries: https://github.com/open-spaced-repetition/py-fsrs · https://github.com/open-spaced-repetition/ts-fsrs · benchmark (by FSRS authors, not peer-reviewed): https://github.com/open-spaced-repetition/srs-benchmark · Anki retention guidance: https://docs.ankiweb.net/deck-options.html
- Ye, Su & Cao 2022 (KDD), FSRS precursor: https://doi.org/10.1145/3534678.3539081
- Watkins & Biggs (eds.) 1996, *The Chinese Learner*: https://cerc.edu.hku.hk/?p=3095 · Kember 1996: https://link.springer.com/article/10.1007/BF00128436 · Dahlin & Watkins 2000: https://doi.org/10.1348/000709900157976
- Hifz and memory (small n): https://pure.york.ac.uk/portal/en/publications/does-learning-the-quran-improve-memory-capacity-practical-and-the/
- Lyster & Ranta 1997, corrective feedback: https://doi.org/10.1017/s0272263197001034 · Li 2010 meta-analysis: https://researchspace.auckland.ac.nz/handle/2292/24985
- Swain & Lapkin 1995, output: https://doi.org/10.1093/applin/16.3.371
- Conklin & Schmitt 2008, formulaic sequences: https://nottingham-repository.worktribe.com/output/3208445/formulaic-sequences-are-they-processed-more-quickly-than-nonformulaic-language-by-native-and-nonnative-speakers
- Nation 2006, vocabulary coverage: https://openaccess.wgtn.ac.nz/articles/journal_contribution/How_large_a_vocabulary_is_needed_for_reading_and_listening_/12552221/1
- Hamada 2014, shadowing: https://jalt-publications.org/sites/default/files/pdf-article/38.1tlt_art1.pdf
- Ryan & Deci 2000, SDT: https://doi.org/10.1037/0003-066X.55.1.68 · Deci, Koestner & Ryan 1999, rewards: https://pure.ewha.ac.kr/en/publications/a-meta-analytic-review-of-experiments-examining-the-effects-of-ex/
- Sailer & Homner 2020, gamification: https://link.springer.com/article/10.1007/s10648-019-09498-w
- Kivetz et al. 2006, goal gradient: https://business.columbia.edu/faculty/research/goal-gradient-hypothesis-resurrected-purchase-acceleration-illusionary-goal
- Gollwitzer & Sheeran 2006, implementation intentions: https://kops.uni-konstanz.de/entities/publication/2e749bfb-8533-437c-8203-7e788c910c5f
- Lally et al. 2010, habit formation: https://doi.org/10.1002/ejsp.674
- Duolingo streaks (company-reported): https://blog.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals/
- "Goldfish attention span" myth: https://internet.psych.wisc.edu/wp-content/uploads/532-Master/532-UnitPages/Unit-09/Goldfish_MythBusting.pdf
- Short-form video and attention, meta-analysis (correlational): https://ifp.nyu.edu/2025/journal-article-abstracts/bul0000498/
- Goethe-Institut hours per level: https://www.goethe.de/ins/gb/en/m/sta/lon/kur/faq.html
- Goethe-Zertifikat B1 rules (modules, 100 points each, pass at 60): https://www.goethe.de/resources/files/pdf325/durchfuehrungsbestimmungen_b1-1.pdf


**Vendors**
- OpenAI pricing: https://developers.openai.com/api/docs/pricing · Realtime VAD: https://developers.openai.com/api/docs/guides/realtime-vad · push-to-talk: https://developers.openai.com/api/docs/guides/realtime-conversations · cost guide: https://developers.openai.com/api/docs/guides/voice-latency-cost
- Gemini Live: https://ai.google.dev/gemini-api/docs/live-api · pricing: https://ai.google.dev/gemini-api/docs/pricing · session limits: https://ai.google.dev/gemini-api/docs/live-session
- Azure Speech languages (TTS voices, pronunciation assessment): https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support · pronunciation how-to: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-pronunciation-assessment · pricing: https://azure.microsoft.com/en-us/pricing/details/cognitive-services/speech-services/
- Claude models and pricing: https://platform.claude.com/docs/en/about-claude/pricing · prompt caching: https://docs.claude.com/en/docs/build-with-claude/prompt-caching
- SpeechSuper pricing: https://www.speechsuper.com/pricing.html
- MDN SpeechRecognition: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition

**Content and licences**
- §53 UrhG: https://www.gesetze-im-internet.de/urhg/__53.html
- Tagesschau RSS + terms: https://www.tagesschau.de/infoservices/rssfeeds · API docs: https://github.com/bundesAPI/tagesschau-api/blob/main/README.md · CC content: https://www.tagesschau.de/creativecommons
- DW feeds: https://rss.dw.com/xml/DKpodcast_topthemamitvokabeln_de · https://rss.dw.com/xml/DKpodcast_lgn_de · podcasts list: https://learngerman.dw.com/de/podcasts/s-61934454
- nachrichtenleicht usage: https://www.nachrichtenleicht.de/benutzung-100.html
- YouTube IFrame API: https://developers.google.com/youtube/iframe_api_reference · captions.download: https://developers.google.com/youtube/v3/docs/captions/download · developer policies: https://developers.google.com/youtube/terms/developer-policies
- Tatoeba downloads/terms: https://tatoeba.org/en/downloads · https://tatoeba.org/en/terms_of_use
- Kaikki German: https://kaikki.org/dictionary/German/ · Wiktionary licence: https://en.wiktionary.org/wiki/Wiktionary:Copyrights
- DWDS terms: https://www.dwds.de/d/nutzungsbedingungen · Lemmadatenbank: https://www.dwds.de/lemma/list
- Goethe word list (B1): https://www.goethe.de/pro/relaunch/prf/de/Goethe-Zertifikat_B1_Wortliste.pdf
- LanguageTool public API limits: https://dev.languagetool.org/public-http-api · server: https://dev.languagetool.org/http-server
- spaCy German model: https://huggingface.co/spacy/de_core_news_sm
- Piper voices: https://huggingface.co/rhasspy/piper-voices
- Bundesbank terms: https://www.bundesbank.de/de/startseite/benutzerhinweise/benutzerhinweise-642874 · BaFin terms: https://www.bafin.de/DE/service/nutzungsbedingungen/nutzungsbedingungen_node.html

**Claude Code practice**
- Best practices: https://code.claude.com/docs/en/best-practices · CLAUDE.md (target < 200 lines; imports load at launch): https://code.claude.com/docs/en/memory

**Austria / deployment additions (checked 25 Oct 2026)**
- ÖIF Sprachportal, Austria-focused A1–C1 learning materials and practice tests: https://sprachportal.at/deutsch-lernen/
- ÖIF Austria-focused worksheets: https://sprachportal.at/alle-angebote/uebungsblaetter/
- ORF Nachrichten in Einfacher Sprache: https://tv.orf.at/nachrichten-in-einfacher-sprache/index.html
- ÖIF A1 Austria-focused everyday communication: https://sprachportal.at/deutsch-lernen/a1/lernmaterialien/materialien-mit-schwerpunkt-oesterreich-kommunikation-im-alltag/
- University of Vienna, Kleiner Wiener Sprachführer: https://pundp2018.univie.ac.at/kleiner-wiener-sprachfuehrer/
- Austrian Academy of Sciences on greeting/register variation: https://www.oeaw.ac.at/news/was-grussformeln-ueber-soziale-beziehungen-am-land-verraten-1
- Duden, `Mahlzeit` as a lunchtime greeting especially among colleagues: https://www.duden.de/rechtschreibung/Mahlzeit
- Cloudflare Pages React deployment: https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/
- Cloudflare Python Workers + FastAPI: https://developers.cloudflare.com/workers/languages/python/packages/fastapi/
- Cloudflare Python package support: https://developers.cloudflare.com/workers/languages/python/packages/
- Cloudflare D1: https://developers.cloudflare.com/d1/
- Apple: turn a website into an app on iPhone: https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios
- MDN `getUserMedia()` secure-context requirement: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- Azure Speech language/voice support, including German (Austria): https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support
