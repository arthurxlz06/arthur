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

  const { hook_url, hook_ad_name, body_url, body_ad_name } =
    await req.json() as { hook_url: string; hook_ad_name: string; body_url: string; body_ad_name: string }

  if (!hook_url || !body_url || !hook_ad_name || !body_ad_name)
    return NextResponse.json({ error: 'hook_url, hook_ad_name, body_url e body_ad_name são obrigatórios' }, { status: 400 })

  const { data: job, error } = await supabase
    .from('frankenstein_jobs')
    .insert({
      user_id: user.id,
      hook_path: hook_url,
      body_path: body_url,
      hook_ad_name,
      body_ad_name,
    })
    .select('id')
    .single()

  if (error || !job) return NextResponse.json({ error: 'Erro ao criar job' }, { status: 500 })

  await enqueueFrankenJob({
    frankenstein_job_id: job.id as string,
    hook_url,
    body_url,
    hook_ad_name,
    body_ad_name,
    dropbox_access_token: user.dropbox_access_token as string,
    dropbox_refresh_token: (user.dropbox_refresh_token as string | null) ?? null,
    user_id: user.id as string,
  })

  return NextResponse.json({ id: job.id })
}
