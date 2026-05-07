import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { publishJob } from '@/lib/publish'

type RetryJobRow = {
  id: string
  videos: { filename: string; storage_path: string | null; external_url: string | null; media_type: string } | null
  ad_accounts: { meta_account_id: string } | null
}

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email)
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const supabase = getSupabaseAdmin()

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('email', session.user.email)
    .single()
  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const accountId = searchParams.get('account_id')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const perPage = 50

  let query = supabase
    .from('publish_jobs')
    .select(
      `
      id, status, meta_video_id, error_message, queued_at, finished_at,
      videos(id, filename, order_number, folder_id, folders(name)),
      ad_accounts(id, name, meta_account_id)
    `,
      { count: 'exact' }
    )
    .eq('user_id', user.id)
    .order('queued_at', { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1)

  if (status) query = query.eq('status', status)
  if (accountId) query = query.eq('ad_account_id', accountId)
  if (from) query = query.gte('queued_at', from)
  if (to) query = query.lte('queued_at', to)

  const { data: jobs, count, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    jobs: jobs ?? [],
    total: count ?? 0,
    page,
    per_page: perPage,
    total_pages: Math.ceil((count ?? 0) / perPage),
  })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email)
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const supabase = getSupabaseAdmin()

  const { data: user } = await supabase
    .from('users')
    .select('id, facebook_access_token')
    .eq('email', session.user.email)
    .single()
  if (!user?.facebook_access_token)
    return NextResponse.json({ error: 'Token não encontrado' }, { status: 400 })

  const { job_id } = (await req.json()) as { job_id: string }

  const { data: rawJob } = await supabase
    .from('publish_jobs')
    .select('id, videos(filename, storage_path, external_url, media_type), ad_accounts(meta_account_id)')
    .eq('id', job_id)
    .eq('user_id', user.id)
    .eq('status', 'failed')
    .single()

  const job = rawJob as RetryJobRow | null

  if (!job?.videos || !job?.ad_accounts)
    return NextResponse.json(
      { error: 'Job não encontrado ou não está com falha' },
      { status: 404 }
    )

  await supabase
    .from('publish_jobs')
    .update({ status: 'pending', error_message: null, finished_at: null })
    .eq('id', job_id)

  await publishJob({
    jobId: job.id,
    video: job.videos,
    account: job.ad_accounts,
    accessToken: user.facebook_access_token as string,
    supabase,
  })

  return NextResponse.json({ success: true })
}
