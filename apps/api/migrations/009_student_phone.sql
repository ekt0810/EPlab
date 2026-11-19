ALTER TABLE users ADD COLUMN phone text;
ALTER TABLE users ADD CONSTRAINT users_phone_format CHECK (phone IS NULL OR phone ~ '^0[35789][0-9]{8}$');
CREATE INDEX users_phone_idx ON users(phone) WHERE phone IS NOT NULL;

UPDATE settings SET value = value || '{"supportPhone":"","supportEmail":"admin1@example.com"}'::jsonb WHERE key='billing';
