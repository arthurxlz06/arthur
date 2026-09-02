import { NextResponse } from 'next/server'
import { getRules, createRule } from '@/lib/bot/db'

export async function GET() {
  return NextResponse.json({ rules: await getRules() })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!body.name || !body.action || !Array.isArray(body.conditions) || body.conditions.length === 0) {
      return NextResponse.json({ error: 'Campos obrigatórios: name, action, conditions[]' }, { status: 400 })
    }
    const rule = await createRule({
      name: body.name,
      active: body.active ?? true,
      conditions: body.conditions,
      action: body.action,
      action_value: Number(body.action_value) || 0,
      filter_level: body.filter_level ?? 'campaign',
      campaign_filter: body.campaign_filter ?? 'all',
      campaign_filter_text: body.campaign_filter_text ?? '',
      campaign_filter_ids: Array.isArray(body.campaign_filter_ids) ? body.campaign_filter_ids : [],
      cooldown_hours: Number(body.cooldown_hours) || 0,
      allowed_hours: Array.isArray(body.allowed_hours) ? body.allowed_hours : [],
      max_duplicates: Number(body.max_duplicates) || 0,
      duplicate_until: body.duplicate_until ?? '',
    })
    return NextResponse.json({ rule })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
