import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabaseAdmin } from '@/lib/supabase'

function convertDropboxToEmbed(url: string): string {
  let result = url
    .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
    .replace('?dl=0', '?raw=1')
    .replace('?dl=1', '?raw=1')
  if (!result.includes('?raw=1')) {
    result += result.includes('?') ? '&raw=1' : '?raw=1'
  }
  return result
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const supabase = getSupabaseAdmin()
  const { data: user } = await supabase
    .from('users').select('id').eq('email', session.user.email).single()

  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  const { data } = await supabase
    .from('creative_links')
    .select('*')
    .eq('user_id', user.id)

  return NextResponse.json({ links: data ?? [] })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const supabase = getSupabaseAdmin()
  const { data: user } = await supabase
    .from('users').select('id').eq('email', session.user.email).single()

  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  const body = await req.json() as { ad_name?: string; dropbox_url?: string; batch?: { ad_name: string; dropbox_url: string }[] }

  // Batch import via CSV
  if (body.batch && Array.isArray(body.batch)) {
    const rows = body.batch.map((item) => ({
      user_id: user.id,
      ad_name: item.ad_name,
      dropbox_url: item.dropbox_url,
      dropbox_direct_url: convertDropboxToEmbed(item.dropbox_url),
    }))

    const { data, error } = await supabase
      .from('creative_links')
      .upsert(rows, { onConflict: 'user_id,ad_name' })
      .select()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ links: data, count: data?.length ?? 0 })
  }

  // Single insert / update
  const { ad_name, dropbox_url } = body
  if (!ad_name || !dropbox_url) {
    return NextResponse.json({ error: 'ad_name e dropbox_url são obrigatórios' }, { status: 400 })
  }

  const dropbox_direct_url = convertDropboxToEmbed(dropbox_url)

  const { data, error } = await supabase
    .from('creative_links')
    .upsert({ user_id: user.id, ad_name, dropbox_url, dropbox_direct_url }, { onConflict: 'user_id,ad_name' })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ link: data })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.email) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const supabase = getSupabaseAdmin()
  const { data: user } = await supabase
    .from('users').select('id').eq('email', session.user.email).single()

  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  const { id } = await req.json() as { id: string }
  await supabase.from('creative_links').delete().eq('id', id).eq('user_id', user.id)
  return NextResponse.json({ success: true })
}
