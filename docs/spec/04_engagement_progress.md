<!-- Generated from SPEC.md by scripts/split_spec.py. Edit SPEC.md, then rerun. -->

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
