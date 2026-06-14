-- ══════════════════════════════════════════════════════════════════
--  NUDGES SCHEMA FIX — paste this into Turso CLI / SQL console
--  After running, the "no column named user_id" error is gone.
-- ══════════════════════════════════════════════════════════════════

-- 1. Recreate the table with the full correct schema.
--    Safe because we use IF NOT EXISTS and the table already exists.
CREATE TABLE IF NOT EXISTS nudges (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL DEFAULT '',
  user_name       TEXT NOT NULL DEFAULT '',
  user_avatar     TEXT NOT NULL DEFAULT '',
  text            TEXT NOT NULL DEFAULT '',
  font_id         TEXT NOT NULL DEFAULT '',
  font_size       INTEGER DEFAULT 26,
  font_weight     INTEGER DEFAULT 700,
  text_color      TEXT NOT NULL DEFAULT '',
  bg_color        TEXT NOT NULL DEFAULT '',
  gradient_bg     TEXT NOT NULL DEFAULT '',
  border_style    TEXT NOT NULL DEFAULT '',
  border_radius   INTEGER DEFAULT 20,
  text_shadow     TEXT NOT NULL DEFAULT '',
  text_align      TEXT DEFAULT 'center',
  glassmorphism   INTEGER DEFAULT 0,
  layout_style    TEXT DEFAULT 'standard',
  image_url       TEXT,
  image_opacity   REAL DEFAULT 1,
  image_blend     TEXT DEFAULT 'normal',
  created_at      INTEGER DEFAULT 0,
  updated_at      INTEGER DEFAULT 0,
  expires_at      INTEGER DEFAULT 0
);

-- 2. Add the column that is currently missing in your live DB.
--    If it already exists, SQLite will throw "duplicate column name"
--    which is harmless. The app's in-code migration swallows that error.
ALTER TABLE nudges ADD COLUMN user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE nudges ADD COLUMN user_name TEXT NOT NULL DEFAULT '';
ALTER TABLE nudges ADD COLUMN user_avatar TEXT NOT NULL DEFAULT '';
ALTER TABLE nudges ADD COLUMN text TEXT NOT NULL DEFAULT '';
ALTER TABLE nudges ADD COLUMN font_id TEXT NOT NULL DEFAULT '';
ALTER TABLE nudges ADD COLUMN font_size INTEGER DEFAULT 26;
ALTER TABLE nudges ADD COLUMN font_weight INTEGER DEFAULT 700;
ALTER TABLE nudges ADD COLUMN text_color TEXT NOT NULL DEFAULT '';
ALTER TABLE nudges ADD COLUMN bg_color TEXT NOT NULL DEFAULT '';
ALTER TABLE nudges ADD COLUMN gradient_bg TEXT NOT NULL DEFAULT '';
ALTER TABLE nudges ADD COLUMN border_style TEXT NOT NULL DEFAULT '';
ALTER TABLE nudges ADD COLUMN border_radius INTEGER DEFAULT 20;
ALTER TABLE nudges ADD COLUMN text_shadow TEXT NOT NULL DEFAULT '';
ALTER TABLE nudges ADD COLUMN text_align TEXT DEFAULT 'center';
ALTER TABLE nudges ADD COLUMN glassmorphism INTEGER DEFAULT 0;
ALTER TABLE nudges ADD COLUMN layout_style TEXT DEFAULT 'standard';
ALTER TABLE nudges ADD COLUMN image_url TEXT;
ALTER TABLE nudges ADD COLUMN image_opacity REAL DEFAULT 1;
ALTER TABLE nudges ADD COLUMN image_blend TEXT DEFAULT 'normal';
ALTER TABLE nudges ADD COLUMN created_at INTEGER DEFAULT 0;
ALTER TABLE nudges ADD COLUMN updated_at INTEGER DEFAULT 0;
ALTER TABLE nudges ADD COLUMN expires_at INTEGER DEFAULT 0;

-- 3. Indexes (idempotent, safe to run multiple times).
CREATE INDEX IF NOT EXISTS idx_nudges_updated ON nudges(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_nudges_author  ON nudges(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_nudges_expires ON nudges(expires_at);

-- ══════════════════════════════════════════════════════════════════
--  After running this:
--    • Publish Nudges will succeed.
--    • List Nudges will return all columns.
--    • Edit/Delete Nudges will work.
--    • Future schema updates run automatically on app load.
-- ══════════════════════════════════════════════════════════════════
