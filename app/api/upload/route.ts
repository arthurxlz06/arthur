import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabaseAdmin } from '@/lib/supabase'

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

  const { filename, storage_path, folder_id, order_number, size_bytes, media_type } = (await req.json()) as {
    filename: string
    storage_path: string
    folder_id?: string | null
    order_number?: number
    size_bytes?: number
    media_type?: 'video' | 'image'
  }

  const { data: video, error } = await supabase
    .from('videos')
    .insert({
      user_id: user.id,
      folder_id: folder_id || null,
      filename,
      storage_path,
      media_type: media_type ?? 'video',
      order_number: order_number ?? 1,
      size_bytes: size_bytes ?? null,
      import_source: 'manual',
      import_status: 'ready',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ video })
}
