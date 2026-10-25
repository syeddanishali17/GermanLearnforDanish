-- User state only. Learning content (phrases, conversations) is bundled from data/*.json.
-- All times are UTC epoch milliseconds; study days are 'YYYY-MM-DD' in Europe/Vienna.

CREATE TABLE profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  learner_profile_md TEXT NOT NULL DEFAULT '',
  new_per_day INTEGER NOT NULL DEFAULT 6,
  max_reviews_per_day INTEGER NOT NULL DEFAULT 100,
  weekly_target_days INTEGER NOT NULL DEFAULT 5,
  weekly_target_attempts INTEGER NOT NULL DEFAULT 5,
  gate_override INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE auth_session (
  token_hash TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE login_failure (
  id INTEGER PRIMARY KEY,
  ts INTEGER NOT NULL
);

CREATE TABLE item_state (
  slug TEXT PRIMARY KEY,
  introduced_at INTEGER,
  flagged INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE card (
  id INTEGER PRIMARY KEY,
  item_slug TEXT NOT NULL,
  card_type TEXT NOT NULL,
  fsrs TEXT NOT NULL,
  due INTEGER NOT NULL,
  state INTEGER NOT NULL,
  stability REAL,
  last_review INTEGER,
  lapses INTEGER NOT NULL DEFAULT 0,
  UNIQUE (item_slug, card_type)
);
CREATE INDEX card_due ON card (due);

CREATE TABLE review_log (
  id INTEGER PRIMARY KEY,
  client_uuid TEXT UNIQUE,
  card_id INTEGER NOT NULL REFERENCES card (id) ON DELETE CASCADE,
  ts INTEGER NOT NULL,
  rating INTEGER NOT NULL,
  answer_given TEXT,
  answer_mode TEXT NOT NULL DEFAULT 'self',
  elapsed_ms INTEGER,
  block TEXT NOT NULL DEFAULT 'manzil'
);
CREATE INDEX review_log_ts ON review_log (ts);

CREATE TABLE mission (
  id INTEGER PRIMARY KEY,
  day TEXT NOT NULL,
  item_slug TEXT,
  situation TEXT NOT NULL DEFAULT 'other',
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  outcome TEXT,
  reply_heard TEXT,
  understood_reply INTEGER,
  switched_to_english INTEGER,
  notes TEXT,
  created_at INTEGER NOT NULL,
  logged_at INTEGER
);
CREATE INDEX mission_day ON mission (day);

CREATE TABLE day_log (
  day TEXT PRIMARY KEY,
  manzil_done INTEGER NOT NULL DEFAULT 0,
  sabaq_done INTEGER NOT NULL DEFAULT 0,
  bolna_done INTEGER NOT NULL DEFAULT 0,
  produced INTEGER NOT NULL DEFAULT 0,
  study_day INTEGER NOT NULL DEFAULT 0,
  active_s INTEGER NOT NULL DEFAULT 0,
  speaking_s INTEGER NOT NULL DEFAULT 0,
  manzil_s INTEGER NOT NULL DEFAULT 0,
  real_world_attempts INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE content_report (
  id INTEGER PRIMARY KEY,
  item_slug TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  resolved INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE conversation_practice (
  id INTEGER PRIMARY KEY,
  client_uuid TEXT UNIQUE,
  conversation_slug TEXT NOT NULL,
  ts INTEGER NOT NULL,
  mode TEXT NOT NULL,
  result TEXT,
  seconds INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE cost_ledger (
  id INTEGER PRIMARY KEY,
  ts INTEGER NOT NULL,
  vendor TEXT NOT NULL,
  model TEXT NOT NULL,
  units REAL NOT NULL,
  unit_type TEXT NOT NULL,
  eur REAL NOT NULL
);
