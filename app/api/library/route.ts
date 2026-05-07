import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabaseAdmin } from '@/lib/supabase'

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

  const { data: folders } = await supabase
    .from('folders')
    .select('*, videos(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const { data: orphanVideos } = await supabase
    .from('videos')
    .select('*')
    .eq('user_id', user.id)
    .is('folder_id', null)
    .order('order_number', { ascending: true })

  return NextResponse.json({ folders: folders ?? [], orphanVideos: orphanVideos ?? [] })
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

  const { name } = (await req.json()) as { name: string }
  const { data: folder, error } = await supabase
    .from('folders')
    .insert({ user_id: user.id, name })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ folder })
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as {
    video_id?: string
    order_number?: number
    folder_id?: string
    name?: string
  }

  const supabase = getSupabaseAdmin()

  if (body.folder_id && body.name !== undefined) {
    await supabase.from('folders').update({ name: body.name }).eq('id', body.folder_id)
  } else if (body.video_id && body.order_number !== undefined) {
    await supabase.from('videos').update({ order_number: body.order_number }).eq('id', body.video_id)
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: Request) {
  const { type, id } = (await req.json()) as { type: 'folder' | 'video'; id: string }
  const supabase = getSupabaseAdmin()

  if (type === 'folder') {
    await supabase.from('folders').delete().eq('id', id)
  } else {
    const { data: video } = await supabase
      .from('videos')
      .select('storage_path')
      .eq('id', id)
      .single()
    if (video) {
      if (video.storage_path) {
        await supabase.storage.from('videos').remove([video.storage_path])
      }
      await supabase.from('videos').delete().eq('id', id)
    }
  }

  return NextResponse.json({ success: true })
}
