-- Grammar drill sessions: one row per finished practice round of a pattern.
CREATE TABLE grammar_practice (
  id INTEGER PRIMARY KEY,
  client_uuid TEXT UNIQUE,
  code TEXT NOT NULL,
  ts INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  total INTEGER NOT NULL
);
CREATE INDEX grammar_practice_code ON grammar_practice (code, ts);
