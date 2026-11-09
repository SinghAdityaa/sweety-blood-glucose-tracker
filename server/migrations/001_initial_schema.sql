CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reading_date DATE NOT NULL,
  time_slot TEXT NOT NULL CHECK (time_slot IN (
    'morning_fasting', 'after_breakfast', 'after_lunch', 'after_dinner'
  )),
  value_mg_dl INTEGER NOT NULL CHECK (value_mg_dl BETWEEN 40 AND 600),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT readings_one_slot_per_day UNIQUE (user_id, reading_date, time_slot)
);

CREATE INDEX IF NOT EXISTS readings_user_date_idx
  ON readings (user_id, reading_date DESC);
