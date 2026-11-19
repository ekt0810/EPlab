ALTER TABLE submissions ADD COLUMN attachments jsonb NOT NULL DEFAULT '[]'::jsonb
 CHECK (jsonb_typeof(attachments)='array' AND jsonb_array_length(attachments)<=6);
