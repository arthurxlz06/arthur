ALTER TABLE users ADD COLUMN IF NOT EXISTS dropbox_access_token TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS dropbox_refresh_token TEXT;
