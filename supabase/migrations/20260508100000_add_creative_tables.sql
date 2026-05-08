-- creative_links: vínculo entre nome do criativo e URL do Dropbox
CREATE TABLE IF NOT EXISTS creative_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ad_name TEXT NOT NULL,
  dropbox_url TEXT NOT NULL,
  dropbox_direct_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, ad_name)
);

-- creative_metrics_cache: cache server-side de métricas da Meta API (TTL 1h)
CREATE TABLE IF NOT EXISTS creative_metrics_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  since DATE NOT NULL,
  until DATE NOT NULL,
  ads_json JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, account_id, since, until)
);
