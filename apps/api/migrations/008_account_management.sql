ALTER TABLE users ADD COLUMN last_login_at timestamptz;
ALTER TABLE users ADD COLUMN invited_at timestamptz;
UPDATE users u SET last_login_at=l.at FROM (
  SELECT actor_id,max(created_at) AS at FROM audit_logs WHERE action='login' GROUP BY actor_id
) l WHERE u.id=l.actor_id;
ALTER TABLE tokens DROP CONSTRAINT tokens_purpose_check;
ALTER TABLE tokens ADD CONSTRAINT tokens_purpose_check CHECK(purpose IN('verify','reset','invite'));
CREATE INDEX audit_actor_history_idx ON audit_logs(actor_id,id DESC);
CREATE INDEX audit_target_history_idx ON audit_logs(target,id DESC);
CREATE INDEX users_created_idx ON users(created_at DESC,id);
