CREATE TABLE practice_threads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 exercise_id text NOT NULL REFERENCES exercises(id),
 participant_id uuid NOT NULL REFERENCES users(id),
 subject text NOT NULL CHECK(char_length(subject) BETWEEN 3 AND 160),
 resolved boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(exercise_id,participant_id)
);
CREATE TABLE practice_messages (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 thread_id uuid NOT NULL REFERENCES practice_threads(id),
 author_id uuid NOT NULL REFERENCES users(id),
 client_id uuid NOT NULL,
 body text NOT NULL CHECK(char_length(body) BETWEEN 1 AND 3000),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(author_id,client_id)
);
CREATE INDEX practice_threads_queue ON practice_threads(updated_at DESC,id);
CREATE INDEX practice_messages_thread ON practice_messages(thread_id,id);
