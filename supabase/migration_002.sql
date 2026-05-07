-- Migration 002: external_url and media_type support
ALTER TABLE videos ADD COLUMN IF NOT EXISTS external_url TEXT;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'video';
ALTER TABLE videos ALTER COLUMN storage_path DROP NOT NULL;
