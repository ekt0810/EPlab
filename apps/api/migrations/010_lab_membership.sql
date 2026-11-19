CREATE TABLE IF NOT EXISTS lab_memberships (
  user_id uuid PRIMARY KEY REFERENCES users(id),
  status text NOT NULL CHECK (status IN ('pending','approved','rejected','revoked')),
  tracks text[] NOT NULL CHECK (cardinality(tracks) BETWEEN 1 AND 3 AND tracks <@ ARRAY['embedded','kicad','solidworks']::text[]),
  message text NOT NULL CHECK (char_length(message) BETWEEN 10 AND 1000),
  decision_note text NOT NULL DEFAULT '' CHECK (char_length(decision_note) <= 1000),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lab_memberships_status_idx ON lab_memberships(status,updated_at);
CREATE OR REPLACE VIEW learning_access AS
SELECT u.id AS user_id, (COALESCE(e.active,false) OR COALESCE(m.status='approved',false)) AS active
FROM users u LEFT JOIN entitlements e ON e.user_id=u.id LEFT JOIN lab_memberships m ON m.user_id=u.id;
INSERT INTO settings(key,value) VALUES ('access_mode','"lab"') ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value;
