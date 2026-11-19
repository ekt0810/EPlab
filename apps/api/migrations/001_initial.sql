CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE CHECK(email=lower(email)), name text NOT NULL,
 password_hash text NOT NULL, role text NOT NULL DEFAULT 'student' CHECK(role IN('student','admin')),
 admin_slot smallint UNIQUE CHECK(admin_slot IN(1,2)), verified boolean NOT NULL DEFAULT false, blocked boolean NOT NULL DEFAULT false,
 mfa_secret text, mfa_pending text, mfa_last_step bigint, recovery_hashes jsonb NOT NULL DEFAULT '[]',
 created_at timestamptz NOT NULL DEFAULT now(), CHECK ((role='admin')=(admin_slot IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS sessions (
 id text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 csrf text NOT NULL, mfa_verified boolean NOT NULL DEFAULT false, reauth_at timestamptz,
 user_agent text, created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE TABLE IF NOT EXISTS tokens (
 hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 purpose text NOT NULL CHECK(purpose IN('verify','reset')), expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS courses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text UNIQUE NOT NULL, category text NOT NULL CHECK(category IN('embedded','kicad','solidworks')),
 title text NOT NULL, description text NOT NULL, level text NOT NULL DEFAULT 'Cơ bản', status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','published')),
 position integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS chapters (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
 title text NOT NULL, position integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS lessons (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), chapter_id uuid NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
 slug text UNIQUE NOT NULL, title text NOT NULL, summary text NOT NULL DEFAULT '', objectives text NOT NULL DEFAULT '', prerequisites text NOT NULL DEFAULT '',
 content text NOT NULL DEFAULT '', exercise text NOT NULL DEFAULT '', answer text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','published')), preview boolean NOT NULL DEFAULT false,
 position integer NOT NULL DEFAULT 0, duration_minutes integer CHECK(duration_minutes>0), software_version text NOT NULL DEFAULT '',
 video_url text, video_type text NOT NULL DEFAULT 'reference' CHECK(video_type IN('youtube','reference','private','none')),
 author text NOT NULL DEFAULT 'EP LAB', language text NOT NULL DEFAULT 'Tiếng Việt', source_url text,
 rights text NOT NULL DEFAULT 'unverified' CHECK(rights IN('public_reference','owned','licensed','unverified')),
 source_checked_at timestamptz, embed_verified boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(status!='published' OR rights!='unverified'),
 CHECK(preview OR video_type NOT IN('youtube','reference') OR video_url IS NULL)
);
CREATE INDEX IF NOT EXISTS chapters_course_idx ON chapters(course_id);
CREATE INDEX IF NOT EXISTS lessons_chapter_idx ON lessons(chapter_id);
CREATE TABLE IF NOT EXISTS resources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
 name text NOT NULL, storage_key text NOT NULL UNIQUE, content_type text NOT NULL, size bigint NOT NULL CHECK(size>0), sha256 text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS progress (
 user_id uuid REFERENCES users(id) ON DELETE CASCADE, lesson_id uuid REFERENCES lessons(id) ON DELETE CASCADE,
 completed boolean NOT NULL DEFAULT false, note text NOT NULL DEFAULT '', updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,lesson_id)
);
CREATE TABLE IF NOT EXISTS orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id), code text UNIQUE NOT NULL,
 amount integer NOT NULL CHECK(amount>0), status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','paid','expired','cancelled','refunded')),
 bank_snapshot jsonb NOT NULL, reported_at timestamptz, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), paid_at timestamptz
);
CREATE INDEX IF NOT EXISTS orders_user_idx ON orders(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS orders_one_pending ON orders(user_id) WHERE status='pending';
CREATE TABLE IF NOT EXISTS payment_transactions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL UNIQUE REFERENCES orders(id),
 reference text UNIQUE NOT NULL, amount integer NOT NULL CHECK(amount>0), verified_by uuid REFERENCES users(id),
 source text NOT NULL, note text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), refunded_at timestamptz, refund_reference text UNIQUE
);
CREATE TABLE IF NOT EXISTS entitlements (
 user_id uuid PRIMARY KEY REFERENCES users(id), order_id uuid UNIQUE NOT NULL REFERENCES orders(id),
 active boolean NOT NULL DEFAULT true, granted_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_logs (
 id bigserial PRIMARY KEY, actor_id uuid REFERENCES users(id), action text NOT NULL, target text, metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS settings (key text PRIMARY KEY, value jsonb NOT NULL);
INSERT INTO settings(key,value) VALUES ('billing','{"price":150000,"bankName":"","accountNumber":"","accountHolder":"","enabled":false,"supportEmail":""}'),('maintenance','false') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS login_limits (key text PRIMARY KEY, attempts integer NOT NULL DEFAULT 0, window_start timestamptz NOT NULL DEFAULT now());
