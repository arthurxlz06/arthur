import { NextResponse } from 'next/server'
import { Client } from 'pg'

const MIGRATIONS = [
  `ALTER TABLE bot_rules ADD COLUMN IF NOT EXISTS filter_level TEXT DEFAULT 'campaign'`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS facebook_access_token TEXT`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS facebook_user_id TEXT`,
]

export async function POST() {
  // Use full connection string (pooler) — individual host may be IPv6-only
  const connectionString = process.env.POSTGRES_URL_NON_POOLING
    || process.env.POSTGRES_URL
    || `postgresql://${process.env.POSTGRES_USER || 'postgres'}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}/${process.env.POSTGRES_DATABASE || 'postgres'}`
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })

  try {
    await client.connect()
    const results = []
    for (const sql of MIGRATIONS) {
      await client.query(sql)
      results.push({ sql: sql.slice(0, 70), ok: true })
    }
    await client.end()
    return NextResponse.json({ ok: true, results })
  } catch (err) {
    await client.end().catch(() => {})
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
