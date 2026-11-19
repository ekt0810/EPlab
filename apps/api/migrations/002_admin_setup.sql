ALTER TABLE users ADD COLUMN IF NOT EXISTS setup_pending boolean NOT NULL DEFAULT false;
