<!-- Generated from SPEC.md by scripts/split_spec.py. Edit SPEC.md, then rerun. -->

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
