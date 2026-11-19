CREATE TABLE classroom_progress (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  track text NOT NULL CHECK (track IN ('embedded','kicad','solidworks')),
  lesson_id text NOT NULL,
  scene integer NOT NULL DEFAULT 0 CHECK (scene >= 0 AND scene <= 30),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 10000),
  checklist jsonb NOT NULL DEFAULT '[]',
  quiz_passed boolean NOT NULL DEFAULT false,
  quiz_attempts integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, track, lesson_id)
);
CREATE TABLE classroom_messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  track text NOT NULL CHECK (track IN ('embedded','kicad','solidworks')),
  lesson_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('teacher','reviewer','peer')),
  question text NOT NULL CHECK (length(question) <= 2000),
  answer text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('guide','ai')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX classroom_messages_owner ON classroom_messages(user_id, track, lesson_id, id DESC);
