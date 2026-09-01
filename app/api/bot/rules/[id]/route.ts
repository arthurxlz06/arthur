import { NextResponse } from 'next/server'
import { updateRule, deleteRule } from '@/lib/bot/db'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const rule = await updateRule(params.id, body)
    if (!rule) return NextResponse.json({ error: 'Regra não encontrada' }, { status: 404 })
    return NextResponse.json({ rule })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ok = await deleteRule(params.id)
  if (!ok) return NextResponse.json({ error: 'Regra não encontrada' }, { status: 404 })
  return NextResponse.json({ success: true })
}
