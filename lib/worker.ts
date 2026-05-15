import { Worker, Job } from 'bullmq'
import { redis } from './queue'
import type { PublishJobData } from './queue'
import { getSupabaseAdmin } from './supabase'

async function downloadMedia(
  storagePath: string | null,
  externalUrl: string | null,
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<Blob> {
  if (externalUrl) {
    const res = await fetch(externalUrl, { redirect: 'follow' })
    if (!res.ok) throw new Error(`Download falhou (${res.status}): ${externalUrl}`)
    return res.blob()
  }

  if (storagePath) {
    const { data, error } = await supabase.storage.from('videos').download(storagePath)
    if (error || !data) throw new Error(`Download Supabase falhou: ${error?.message ?? 'sem dados'}`)
    return data
  }

  throw new Error('Nenhuma fonte de arquivo disponível (storage_path e external_url são nulos)')
}

async function publishVideo(
  blob: Blob,
  filename: string,
  metaAccountId: string,
  accessToken: string
): Promise<string> {
  const form = new FormData()
  form.append('source', new Blob([await blob.arrayBuffer()], { type: 'video/mp4' }), filename)
  form.append('name', filename)
  form.append('access_token', accessToken)

  const res = await fetch(
    `https://graph-video.facebook.com/${process.env.META_API_VERSION}/${metaAccountId}/advideos`,
    { method: 'POST', body: form }
  )
  const data = (await res.json()) as { id?: string; error?: { message: string } }
  if (data.error) throw new Error(`Meta API (vídeo): ${data.error.message}`)
  return data.id!
}

async function publishImage(
  blob: Blob,
  filename: string,
  metaAccountId: string,
  accessToken: string
): Promise<string> {
  const form = new FormData()
  form.append('filename', new Blob([await blob.arrayBuffer()], { type: blob.type || 'image/jpeg' }), filename)
  form.append('access_token', accessToken)

  const res = await fetch(
    `https://graph.facebook.com/${process.env.META_API_VERSION}/${metaAccountId}/adimages`,
    { method: 'POST', body: form }
  )
  const data = (await res.json()) as {
    images?: Record<string, { hash: string; url: string }>
    error?: { message: string }
  }
  if (data.error) throw new Error(`Meta API (imagem): ${data.error.message}`)

  const imageEntry = Object.values(data.images ?? {})[0]
  if (!imageEntry?.hash) throw new Error('Meta API não retornou hash da imagem')
  return imageEntry.hash
}

async function processPublishJob(job: Job<PublishJobData>) {
  const {
    publish_job_id,
    video_storage_path,
    external_url,
    media_type,
    meta_account_id,
    facebook_access_token,
    video_filename,
  } = job.data

  const supabase = getSupabaseAdmin()

  await supabase
    .from('publish_jobs')
    .update({ status: 'processing' })
    .eq('id', publish_job_id)

  try {
    // 1. Download file (from external URL or Supabase Storage)
    const blob = await downloadMedia(video_storage_path, external_url, supabase)

    // 2. Upload to Meta
    const mediaId = media_type === 'image'
      ? await publishImage(blob, video_filename, meta_account_id, facebook_access_token)
      : await publishVideo(blob, video_filename, meta_account_id, facebook_access_token)

    // 3. For videos: poll until Meta finishes processing (max 10 min)
    if (media_type === 'video') {
      for (let attempt = 0; attempt < 60; attempt++) {
        await new Promise((r) => setTimeout(r, 10_000))

        const statusRes = await fetch(
          `https://graph.facebook.com/${process.env.META_API_VERSION}/${mediaId}?fields=status&access_token=${facebook_access_token}`
        )
        const statusData = (await statusRes.json()) as {
          status?: { processing_progress?: number; video_status?: string }
          error?: { message: string }
        }

        if (statusData.error) throw new Error(`Status check: ${statusData.error.message}`)
        const progress = statusData.status?.processing_progress
        const videoStatus = statusData.status?.video_status
        if (progress === 100 || videoStatus === 'ready') break
      }
    }

    // 4. Mark done
    await supabase
      .from('publish_jobs')
      .update({
        status: 'done',
        meta_video_id: mediaId,
        finished_at: new Date().toISOString(),
      })
      .eq('id', publish_job_id)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    await supabase
      .from('publish_jobs')
      .update({
        status: 'failed',
        error_message: message,
        finished_at: new Date().toISOString(),
      })
      .eq('id', publish_job_id)
    throw err
  }
}

export const publishWorker = new Worker<PublishJobData>('publish-jobs', async (job) => {
  return processPublishJob(job)
}, {
  connection: redis,
  concurrency: 2,
  limiter: { max: 10, duration: 60_000 },
})

publishWorker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} concluído`)
})

publishWorker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} falhou:`, err.message)
})
