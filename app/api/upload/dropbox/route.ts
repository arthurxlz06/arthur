import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabaseAdmin } from '@/lib/supabase'

function convertDropboxUrl(url: string): string {
  try {
    const u = new URL(url)
    u.searchParams.set('dl', '1')
    return u.toString()
  } catch {
    return url.includes('?') ? `${url}&dl=1` : `${url}?dl=1`
  }
}

function extractDropboxFilename(url: string): string {
  const parts = url.split('/')
  const last = parts[parts.length - 1].split('?')[0]
  return decodeURIComponent(last) || 'dropbox-file'
}

interface DropboxBody {
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

  const body = (await req.json()) as DropboxBody
  const { url, folder_id, order_number, filename } = body

  if (!url.includes('dropbox.com')) {
    return NextResponse.json({ error: 'Link do Dropbox inválido' }, { status: 400 })
  }

  const directUrl = convertDropboxUrl(url)
  const detectedFilename = filename || extractDropboxFilename(url)
  const ext = detectedFilename.split('.').pop()?.toLowerCase() ?? ''
  const mediaType = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'].includes(ext) ? 'image' : 'video'

  // Verify the link is accessible before saving
  let headOk = false
  try {
    const head = await fetch(directUrl, { method: 'HEAD', redirect: 'follow' })
    headOk = head.ok
  } catch {
    // ignore – save anyway; user sees error when publishing if URL is bad
  }

  if (!headOk) {
    return NextResponse.json(
      { error: 'Não foi possível acessar o arquivo. Verifique se o link é público (Anyone with the link).' },
      { status: 400 }
    )
  }

  const { data: video, error: dbError } = await supabase
    .from('videos')
    .insert({
      user_id: user.id,
      folder_id: folder_id || null,
      filename: detectedFilename,
      storage_path: null,
      external_url: directUrl,
      media_type: mediaType,
      order_number: order_number ?? 1,
      import_source: 'dropbox',
      import_status: 'ready',
    })
    .select()
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({ video, message: 'Link importado com sucesso' })
}
