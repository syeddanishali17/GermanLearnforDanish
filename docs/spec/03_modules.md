<!-- Generated from SPEC.md by scripts/split_spec.py. Edit SPEC.md, then rerun. -->

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
