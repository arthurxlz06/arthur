CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  facebook_access_token TEXT,
  facebook_user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS business_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  meta_bm_id TEXT NOT NULL,
  name TEXT,
  connected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ad_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bm_id UUID REFERENCES business_managers(id) ON DELETE CASCADE,
  meta_account_id TEXT NOT NULL,
  name TEXT,
  status TEXT DEFAULT 'active',
  is_selected BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  storage_path TEXT,
  external_url TEXT,
  media_type TEXT NOT NULL DEFAULT 'video',
  order_number INTEGER,
  duration_seconds INTEGER,
  size_bytes BIGINT,
  import_source TEXT DEFAULT 'manual',
  import_status TEXT DEFAULT 'ready',
  import_error TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS publish_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES videos(id),
  ad_account_id UUID REFERENCES ad_accounts(id),
  user_id UUID REFERENCES users(id),
  status TEXT DEFAULT 'pending',
  meta_video_id TEXT,
  error_message TEXT,
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);
