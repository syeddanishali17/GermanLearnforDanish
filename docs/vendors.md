# Vendors

No paid external API is called in Phase 0/1. Phase 1 audio uses the browser's built-in speech synthesis.

Before Phase 2 wires a paid vendor, fill in this table from the vendor's current docs (prices and policies change; re-check, do not copy from memory).

| Vendor | Use | Locale / voice | Price (date checked) | Retention / training policy | Decision |
|---|---|---|---|---|---|
| Azure Speech | STT, TTS, pronunciation assessment | de-AT voices listed in Azure language support | | | candidate for de-AT TTS |
| OpenAI | STT (transcribe models) | de | | | candidate for STT |
| Anthropic Claude | Tutor / Grader / Author | n/a | | | candidate for LLM roles |
| Browser speechSynthesis | Phase 1 TTS fallback | de-AT if the device has one, else de-DE | free | on-device | in use |

Phase 2 test protocol: record 20 real beginner utterances from Danish on the iPhone, run each STT candidate, compare transcripts by hand, and listen to 10 TTS phrases per voice. Record results here before choosing.
