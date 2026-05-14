import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { enqueueFrankenJob } from '@/lib/queue'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const supabase = getSupabaseAdmin()
  const { data: user } = await supabase
    .from('users')
    .select('id, dropbox_access_token, dropbox_refresh_token')
    .eq('email', session.user.email)
    .single()

  if (!user?.dropbox_access_token)
    return NextResponse.json({ error: 'Dropbox não conectado. Conecte em Configurações.' }, { status: 400 })

  const { hook_path, body_path } = await req.json() as { hook_path: string; body_path: string }
  if (!hook_path || !body_path)
    return NextResponse.json({ error: 'hook_path e body_path são obrigatórios' }, { status: 400 })

  const { data: job, error } = await supabase
    .from('frankenstein_jobs')
    .insert({
      user_id: user.id,
      hook_path,
      body_path,
    })
    .select('id')
    .single()

  if (error || !job) return NextResponse.json({ error: 'Erro ao criar job' }, { status: 500 })

  await enqueueFrankenJob({
    frankenstein_job_id: job.id as string,
    hook_path,
    body_path,
    dropbox_access_token: user.dropbox_access_token as string,
    dropbox_refresh_token: (user.dropbox_refresh_token as string | null) ?? null,
    user_id: user.id as string,
  })

  return NextResponse.json({ id: job.id })
}
