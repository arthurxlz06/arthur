import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { publishJob } from '@/lib/publish'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const supabase = getSupabaseAdmin()

  const { data: user } = await supabase
    .from('users')
    .select('id, facebook_access_token')
    .eq('email', session.user.email)
    .single()

  if (!user?.facebook_access_token) {
    return NextResponse.json({ error: 'Token do Facebook não encontrado' }, { status: 400 })
  }

  const { folder_id, account_ids } = (await req.json()) as {
    folder_id: string | null
    account_ids: string[]
  }

  if (!account_ids?.length) {
    return NextResponse.json({ error: 'Selecione ao menos uma conta' }, { status: 400 })
  }

  let videoQuery = supabase
    .from('videos')
    .select('id, filename, storage_path, external_url, media_type, order_number')
    .eq('user_id', user.id)
    .eq('import_status', 'ready')
    .order('order_number', { ascending: true })

  videoQuery = folder_id
    ? videoQuery.eq('folder_id', folder_id)
    : videoQuery.is('folder_id', null)

  const { data: videos, error: videoError } = await videoQuery
  if (videoError) return NextResponse.json({ error: videoError.message }, { status: 500 })
  if (!videos?.length) return NextResponse.json({ error: 'Nenhum arquivo disponível' }, { status: 400 })

  const { data: accounts } = await supabase
    .from('ad_accounts')
    .select('id, meta_account_id')
    .in('id', account_ids)
  if (!accounts?.length) return NextResponse.json({ error: 'Contas não encontradas' }, { status: 400 })

  const jobsToInsert = videos.flatMap((video) =>
    accounts.map((account) => ({
      video_id: video.id,
      ad_account_id: account.id,
      user_id: user.id,
      status: 'pending',
    }))
  )

  const { data: createdJobs, error: jobsError } = await supabase
    .from('publish_jobs')
    .insert(jobsToInsert)
    .select()

  if (jobsError) return NextResponse.json({ error: jobsError.message }, { status: 500 })

  // Process all jobs in parallel — Meta downloads files via file_url, nenhum byte passa pelo servidor
  await Promise.allSettled(
    createdJobs.map((job) => {
      const video = videos.find((v) => v.id === job.video_id)!
      const account = accounts.find((a) => a.id === job.ad_account_id)!
      return publishJob({
        jobId: job.id,
        video,
        account,
        accessToken: user.facebook_access_token as string,
        supabase,
      })
    })
  )

  const { data: finalJobs } = await supabase
    .from('publish_jobs')
    .select('status')
    .in('id', createdJobs.map((j) => j.id))

  const done = finalJobs?.filter((j) => j.status === 'done').length ?? 0
  const failed = finalJobs?.filter((j) => j.status === 'failed').length ?? 0

  return NextResponse.json({ success: true, done, failed, total: createdJobs.length })
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const supabase = getSupabaseAdmin()

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('email', session.user.email)
    .single()
  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  const { data: jobs } = await supabase
    .from('publish_jobs')
    .select(`
      id, status, meta_video_id, error_message, queued_at, finished_at,
      videos(filename, order_number, media_type),
      ad_accounts(name, meta_account_id)
    `)
    .eq('user_id', user.id)
    .order('queued_at', { ascending: false })
    .limit(100)

  return NextResponse.json({ jobs: jobs ?? [] })
}
