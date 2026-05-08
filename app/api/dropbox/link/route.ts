import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabaseAdmin } from '@/lib/supabase'

function convertToEmbed(url: string): string {
  return url
    .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
    .replace('?dl=0', '?raw=1')
    .replace('?dl=1', '?raw=1')
    + (url.includes('?') ? '' : '?raw=1')
}

async function refreshDropboxToken(refreshToken: string): Promise<string | null> {
  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.DROPBOX_APP_KEY!,
      client_secret: process.env.DROPBOX_APP_SECRET!,
    }),
  })
  const data = await res.json() as { access_token?: string }
  return data.access_token ?? null
}

async function getOrCreateSharedLink(token: string, path: string): Promise<string | null> {
  const res = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, settings: { requested_visibility: 'public' } }),
  })
  let data: { url?: string; error_summary?: string; shared_link_already_exists?: { metadata?: { url: string } } }
  try { data = await res.json() } catch { return null }
  return data.url ?? data.shared_link_already_exists?.metadata?.url ?? null
}

// GET — lista arquivos de uma pasta
export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.email) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const supabase = getSupabaseAdmin()
    const { data: user } = await supabase
      .from('users').select('id, dropbox_access_token, dropbox_refresh_token')
      .eq('email', session.user.email).single()

    if (!user?.dropbox_access_token)
      return NextResponse.json({ error: 'Dropbox não conectado' }, { status: 400 })

    const { searchParams } = new URL(req.url)
    const path = searchParams.get('path') ?? ''

    let token = user.dropbox_access_token as string

    const listFiles = async (t: string) => {
      const r = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, recursive: false }),
      })
      return r.json() as Promise<{ entries?: { '.tag': string; name: string; path_lower: string }[]; error_summary?: string }>
    }

    let data = await listFiles(token)

    if (data.error_summary && user.dropbox_refresh_token) {
      const newToken = await refreshDropboxToken(user.dropbox_refresh_token as string)
      if (newToken) {
        token = newToken
        await supabase.from('users').update({ dropbox_access_token: newToken }).eq('id', user.id)
        data = await listFiles(token)
      }
    }

    if (data.error_summary)
      return NextResponse.json({ error: data.error_summary }, { status: 500 })

    const files = (data.entries ?? [])
      .filter((e) => e['.tag'] === 'file')
      .map((e) => ({ name: e.name.replace(/\.[^/.]+$/, ''), path: e.path_lower }))

    return NextResponse.json({ files })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// POST — vincula um arquivo específico a um criativo
export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.email) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const supabase = getSupabaseAdmin()
    const { data: user } = await supabase
      .from('users').select('id, dropbox_access_token, dropbox_refresh_token')
      .eq('email', session.user.email).single()

    if (!user?.dropbox_access_token)
      return NextResponse.json({ error: 'Dropbox não conectado' }, { status: 400 })

    const { file_path, ad_name } = await req.json() as { file_path: string; ad_name: string }

    let token = user.dropbox_access_token as string
    let sharedUrl = await getOrCreateSharedLink(token, file_path)

    if (!sharedUrl && user.dropbox_refresh_token) {
      const newToken = await refreshDropboxToken(user.dropbox_refresh_token as string)
      if (newToken) {
        token = newToken
        await supabase.from('users').update({ dropbox_access_token: newToken }).eq('id', user.id)
        sharedUrl = await getOrCreateSharedLink(token, file_path)
      }
    }

    if (!sharedUrl)
      return NextResponse.json({ error: 'Não foi possível gerar link do Dropbox' }, { status: 500 })

    const dropbox_direct_url = convertToEmbed(sharedUrl)

    await supabase.from('creative_links').upsert(
      { user_id: user.id, ad_name, dropbox_url: sharedUrl, dropbox_direct_url },
      { onConflict: 'user_id,ad_name' }
    )

    return NextResponse.json({ dropbox_url: sharedUrl, dropbox_direct_url })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
