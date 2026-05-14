ALTER TABLE frankenstein_jobs
  ADD COLUMN IF NOT EXISTS hook_ad_name TEXT,
  ADD COLUMN IF NOT EXISTS body_ad_name TEXT;
