ALTER TABLE submissions ADD COLUMN self_checks jsonb NOT NULL DEFAULT '[]'
  CHECK (jsonb_typeof(self_checks) = 'array');
