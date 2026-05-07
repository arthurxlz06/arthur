import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 300

function extractDriveFileId(url: string): string | null {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

async function getDirectDownloadUrl(fileId: string): Promise<string> {
  const baseUrl = `https://drive.google.com/uc?export=download&id=${fileId}`
  const res = await fetch(baseUrl, { redirect: 'follow' })
  const contentType = res.headers.get('content-type') ?? ''

  if (contentType.includes('text/html')) {
    const html = await res.text()
    const confirmMatch = html.match(/confirm=([a-zA-Z0-9_-]+)/)
    if (confirmMatch) {
      return `https://drive.google.com/uc?export=download&confirm=${confirmMatch[1]}&id=${fileId}`
    }
    return `https://drive.google.com/uc?export=download&confirm=t&id=${fileId}`
  }

  return baseUrl
}

interface GDriveBody {
  url: string
  folder_id?: string | null
  order_number?: number
  filename?: string
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const supabase = getSupabaseAdmin()

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('email', session.user.email)
    .single()
  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  const body = (await req.json()) as GDriveBody
  const { url, folder_id, order_number, filename } = body

  const fileId = extractDriveFileId(url)
  if (!fileId) return NextResponse.json({ error: 'Link do Google Drive inválido' }, { status: 400 })

  const storagePath = `${user.id}/${Date.now()}-gdrive-${fileId}.mp4`

  const { data: video, error: dbError } = await supabase
    .from('videos')
    .insert({
      user_id: user.id,
      folder_id: folder_id || null,
      filename: filename || `drive-${fileId}.mp4`,
      storage_path: storagePath,
      order_number: order_number ?? 1,
      import_source: 'gdrive',
      import_status: 'importing',
    })
    .select()
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  const videoId = video.id

  void (async () => {
    try {
      const downloadUrl = await getDirectDownloadUrl(fileId)
      const fileRes = await fetch(downloadUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Cookie': 'download_warning=t',
        },
        redirect: 'follow',
      })

      if (!fileRes.ok) throw new Error(`Download falhou: ${fileRes.status}`)

      if (!fileRes.body) throw new Error('Resposta sem corpo')
      const contentLength = fileRes.headers.get('content-length')
      const sizeBytes = contentLength ? parseInt(contentLength) : null
      const contentType = fileRes.headers.get('content-type') ?? 'video/mp4'

      const { error: uploadError } = await supabase.storage
        .from('videos')
        .upload(storagePath, fileRes.body, { contentType })

      if (uploadError) throw new Error(uploadError.message)

      await supabase
        .from('videos')
        .update({ import_status: 'ready', size_bytes: sizeBytes })
        .eq('id', videoId)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido'
      await supabase
        .from('videos')
        .update({ import_status: 'error', import_error: message })
        .eq('id', videoId)
    }
  })()

  return NextResponse.json({ video, message: 'Importação iniciada' })
}
