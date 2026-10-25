<!-- Generated from SPEC.md by scripts/split_spec.py. Edit SPEC.md, then rerun. -->

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
