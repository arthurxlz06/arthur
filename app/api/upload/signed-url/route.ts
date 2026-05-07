import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabaseAdmin } from '@/lib/supabase'

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'])

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

  const { filename } = (await req.json()) as { filename: string }
  const ext = (filename.split('.').pop() ?? 'mp4').toLowerCase()
  const isImage = IMAGE_EXTS.has(ext)
  const storage_path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { data, error } = await supabase.storage
    .from('videos')
    .createSignedUploadUrl(storage_path)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    signedUrl: data.signedUrl,
    token: data.token,
    storage_path,
    media_type: isImage ? 'image' : 'video',
  })
}
