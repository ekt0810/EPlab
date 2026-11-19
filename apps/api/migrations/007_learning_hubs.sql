-- Explicit public catalog opt-in for future lessons. Existing drafts stay private.
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS listed boolean NOT NULL DEFAULT false;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS level text NOT NULL DEFAULT 'basic'
  CHECK (level IN ('basic','intermediate','advanced','all'));
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'student'
  CHECK (audience IN ('student','host'));
UPDATE lessons l SET level = CASE WHEN k.module <= 3 THEN 'basic' WHEN k.module <= 6 THEN 'intermediate' ELSE 'advanced' END
  FROM kicad_lessons k WHERE k.lesson_id=l.id;
UPDATE lessons SET level='all' WHERE slug LIKE 'eplab-giao-trinh-%';
