<!-- Generated from SPEC.md by scripts/split_spec.py. Edit SPEC.md, then rerun. -->

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
