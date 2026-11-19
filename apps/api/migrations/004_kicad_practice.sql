CREATE TABLE kicad_lessons (
 lesson_id uuid PRIMARY KEY REFERENCES lessons(id) ON DELETE CASCADE,
 source_id text NOT NULL UNIQUE, module integer NOT NULL CHECK(module BETWEEN 1 AND 8), body jsonb NOT NULL
);
CREATE TABLE exercises (
 id text PRIMARY KEY, course_id uuid NOT NULL REFERENCES courses(id), body jsonb NOT NULL,
 published boolean NOT NULL DEFAULT true
);
CREATE TABLE quiz_results (
 user_id uuid NOT NULL REFERENCES users(id), lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
 attempts integer NOT NULL DEFAULT 1, passed boolean NOT NULL, last_answer integer NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,lesson_id)
);
CREATE TABLE assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), exercise_id text NOT NULL REFERENCES exercises(id),
 student_id uuid REFERENCES users(id), created_by uuid NOT NULL REFERENCES users(id),
 instructions text NOT NULL DEFAULT '', due_at timestamptz, closed boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE submissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
 exercise_id text NOT NULL REFERENCES exercises(id), assignment_id uuid REFERENCES assignments(id),
 status text NOT NULL CHECK(status IN('pending_manual','needs_review','visual_pass','needs_revision')),
 notes text NOT NULL, report text, images text NOT NULL, image_count integer NOT NULL CHECK(image_count BETWEEN 1 AND 2),
 image_hash text NOT NULL, fingerprint text NOT NULL, rubric jsonb NOT NULL, result text,
 revision integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,fingerprint)
);
CREATE INDEX submissions_owner ON submissions(user_id,created_at DESC);
CREATE INDEX submissions_queue ON submissions(status,created_at);
CREATE TABLE submission_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), submission_id uuid NOT NULL REFERENCES submissions(id),
 reviewer_id uuid NOT NULL REFERENCES users(id), result jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
