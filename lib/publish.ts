import { getSupabaseAdmin } from './supabase'

type Supabase = ReturnType<typeof getSupabaseAdmin>

const API_VERSION = process.env.META_API_VERSION ?? 'v25.0'

async function getFileUrl(
  storagePath: string | null,
  externalUrl: string | null,
  supabase: Supabase
): Promise<string> {
  if (externalUrl) return externalUrl
  if (!storagePath) throw new Error('Nenhuma fonte de arquivo disponível')
  const { data, error } = await supabase.storage.from('videos').createSignedUrl(storagePath, 3600)
  if (error || !data?.signedUrl) throw new Error('Falha ao gerar URL de download')
  return data.signedUrl
}

async function uploadVideo(fileUrl: string, filename: string, accountId: string, token: string): Promise<string> {
  const form = new URLSearchParams({ file_url: fileUrl, name: filename, access_token: token })
  const res = await fetch(
    `https://graph-video.facebook.com/${API_VERSION}/${accountId}/advideos`,
    { method: 'POST', body: form, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  )
  const data = (await res.json()) as { id?: string; error?: { message: string } }
  if (data.error) throw new Error(`Meta API (vídeo): ${data.error.message}`)
  if (!data.id) throw new Error('Meta não retornou ID do vídeo')
  return data.id
}

async function uploadImage(fileUrl: string, filename: string, accountId: string, token: string): Promise<string> {
  // Download image bytes (images are small, typically < 10 MB)
  const imgRes = await fetch(fileUrl, { redirect: 'follow' })
  if (!imgRes.ok) throw new Error(`Download da imagem falhou: ${imgRes.status}`)
  const buffer = await imgRes.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')

  const form = new URLSearchParams({ bytes: base64, name: filename, access_token: token })
  const res = await fetch(
    `https://graph.facebook.com/${API_VERSION}/${accountId}/adimages`,
    { method: 'POST', body: form, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  )
  const data = (await res.json()) as {
    images?: Record<string, { hash: string }>
    error?: { message: string }
  }
  if (data.error) throw new Error(`Meta API (imagem): ${data.error.message}`)
  const entry = Object.values(data.images ?? {})[0]
  if (!entry?.hash) throw new Error('Meta API não retornou hash da imagem')
  return entry.hash
}

export async function publishJob(params: {
  jobId: string
  video: {
    storage_path: string | null
    external_url: string | null
    media_type: string
    filename: string
  }
  account: { meta_account_id: string }
  accessToken: string
  supabase: Supabase
}): Promise<void> {
  const { jobId, video, account, accessToken, supabase } = params

  await supabase.from('publish_jobs').update({ status: 'processing' }).eq('id', jobId)

  try {
    const fileUrl = await getFileUrl(video.storage_path, video.external_url, supabase)

    const mediaId =
      video.media_type === 'image'
        ? await uploadImage(fileUrl, video.filename, account.meta_account_id, accessToken)
        : await uploadVideo(fileUrl, video.filename, account.meta_account_id, accessToken)

    await supabase
      .from('publish_jobs')
      .update({ status: 'done', meta_video_id: mediaId, finished_at: new Date().toISOString() })
      .eq('id', jobId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    await supabase
      .from('publish_jobs')
      .update({ status: 'failed', error_message: message, finished_at: new Date().toISOString() })
      .eq('id', jobId)
  }
}
