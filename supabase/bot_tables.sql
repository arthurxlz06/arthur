-- Tabelas do Bot de Escala
-- Execute no SQL Editor do Supabase Dashboard

CREATE TABLE IF NOT EXISTS bot_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  conditions JSONB NOT NULL DEFAULT '[]',
  action TEXT NOT NULL,
  action_value NUMERIC DEFAULT 0,
  campaign_filter TEXT DEFAULT 'all',
  campaign_filter_text TEXT DEFAULT '',
  campaign_filter_ids JSONB DEFAULT '[]',
  cooldown_hours NUMERIC DEFAULT 0,
  allowed_hours JSONB DEFAULT '[]',
  max_duplicates INTEGER DEFAULT 0,
  duplicate_until TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bot_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  campaign_id TEXT,
  campaign_name TEXT,
  rule_name TEXT,
  action TEXT,
  details TEXT,
  dry_run BOOLEAN DEFAULT true,
  success BOOLEAN DEFAULT true,
  error TEXT
);

-- Configurações (sempre 1 linha)
CREATE TABLE IF NOT EXISTS bot_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  schedule TEXT DEFAULT '0 8 * * *',
  dry_run BOOLEAN DEFAULT true,
  date_window_days INTEGER DEFAULT 7,
  last_run TIMESTAMPTZ,
  next_run TIMESTAMPTZ,
  CONSTRAINT bot_settings_single CHECK (id = 1)
);
INSERT INTO bot_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Cooldowns (sempre 1 linha)
CREATE TABLE IF NOT EXISTS bot_cooldowns (
  id INTEGER PRIMARY KEY DEFAULT 1,
  last_executed JSONB DEFAULT '{}',
  duplicate_counts JSONB DEFAULT '{}',
  CONSTRAINT bot_cooldowns_single CHECK (id = 1)
);
INSERT INTO bot_cooldowns (id) VALUES (1) ON CONFLICT DO NOTHING;
