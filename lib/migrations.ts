import 'server-only'
import { Client } from 'pg'

const MIGRATIONS = [
  `ALTER TABLE bot_rules ADD COLUMN IF NOT EXISTS filter_level TEXT DEFAULT 'campaign'`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS facebook_access_token TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS facebook_user_id TEXT`,
  `ALTER TABLE ad_accounts ADD COLUMN IF NOT EXISTS active_campaign_count INTEGER DEFAULT 0`,
]

let ran = false

export async function runMigrations() {
  if (ran) return
  ran = true

  const connectionString = process.env.POSTGRES_URL_NON_POOLING
    || process.env.POSTGRES_URL
    || `postgresql://${process.env.POSTGRES_USER || 'postgres'}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:5432/${process.env.POSTGRES_DATABASE || 'postgres'}`

  if (!connectionString || connectionString.includes('undefined')) return

  const prev = process.env.NODE_TLS_REJECT_UNAUTHORIZED
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  const client = new Client({ connectionString })

  try {
    await client.connect()
    for (const sql of MIGRATIONS) {
      await client.query(sql)
    }
    await client.end()
  } catch (err) {
    console.error('[migrations] erro:', err)
    await client.end().catch(() => {})
  } finally {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = prev ?? '1'
  }
}
