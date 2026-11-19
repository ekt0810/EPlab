-- Keep the cited passages and video selection with each saved answer.
-- Historical messages remain readable; the legacy role column is kept for data compatibility.
ALTER TABLE classroom_messages ADD COLUMN evidence jsonb NOT NULL DEFAULT '{}';
