import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data } = await getSupabaseAdmin()
    .from('frankenstein_jobs')
    .select('id, status, output_path, error_msg, created_at, finished_at')
    .eq('id', params.id)
    .single()

  if (!data) return NextResponse.json({ error: 'Job não encontrado' }, { status: 404 })
  return NextResponse.json(data)
}
