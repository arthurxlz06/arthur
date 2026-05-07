import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET() {
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

  const uid = user.id

  const [
    { count: totalJobs },
    { count: doneJobs },
    { count: failedJobs },
    { count: pendingJobs },
    { count: totalVideos },
    { data: recentJobs },
  ] = await Promise.all([
    supabase
      .from('publish_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', uid),
    supabase
      .from('publish_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', uid)
      .eq('status', 'done'),
    supabase
      .from('publish_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', uid)
      .eq('status', 'failed'),
    supabase
      .from('publish_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', uid)
      .in('status', ['pending', 'processing']),
    supabase
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', uid),
    supabase
      .from('publish_jobs')
      .select('id, status, queued_at, videos(filename), ad_accounts(name)')
      .eq('user_id', uid)
      .order('queued_at', { ascending: false })
      .limit(5),
  ])

  const total = totalJobs ?? 0
  const done = doneJobs ?? 0

  return NextResponse.json({
    metrics: {
      total_jobs: total,
      done_jobs: done,
      failed_jobs: failedJobs ?? 0,
      pending_jobs: pendingJobs ?? 0,
      total_videos: totalVideos ?? 0,
      success_rate: total > 0 ? Math.round((done / total) * 100) : 0,
    },
    recent_jobs: recentJobs ?? [],
  })
}
