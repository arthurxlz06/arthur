CREATE TABLE IF NOT EXISTS frankenstein_jobs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hook_path   TEXT NOT NULL,
  body_path   TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'queued',
  output_path TEXT,
  error_msg   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS frankenstein_jobs_user_id_idx ON frankenstein_jobs(user_id);
CREATE INDEX IF NOT EXISTS frankenstein_jobs_status_idx ON frankenstein_jobs(status);
