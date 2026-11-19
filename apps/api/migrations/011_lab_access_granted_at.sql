CREATE OR REPLACE VIEW learning_access AS
SELECT u.id AS user_id,
  (COALESCE(e.active,false) OR COALESCE(m.status='approved',false)) AS active,
  CASE WHEN m.status='approved' THEN m.reviewed_at ELSE e.granted_at END AS granted_at
FROM users u LEFT JOIN entitlements e ON e.user_id=u.id LEFT JOIN lab_memberships m ON m.user_id=u.id;
