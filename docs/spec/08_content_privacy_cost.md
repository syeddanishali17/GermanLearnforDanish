<!-- Generated from SPEC.md by scripts/split_spec.py. Edit SPEC.md, then rerun. -->

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
