import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabaseAdmin } from '@/lib/supabase'

interface DropboxEntry {
  '.tag': string
  name: string
  path_lower: string
}

interface DropboxSharedLink {
  url?: string
  error_summary?: string
  shared_link_already_exists?: { metadata?: { url: string } }
}

function normalizeForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.[^/.]+$/, '')   // remove extensão
    .replace(/[_\-]/g, ' ')     // underscore/hífen → espaço
    .replace(/\s+/g, ' ')
    .trim()
}

function convertSharedLinkToEmbed(url: string): string {
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

async function listDropboxFolder(
  token: string,
  folderPath: string
): Promise<DropboxEntry[] | null> {
  const res = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path: folderPath, recursive: false }),
  })
  const data = await res.json() as { entries?: DropboxEntry[]; error_summary?: string }
  if (data.error_summary) return null
  return (data.entries ?? []).filter((e) => e['.tag'] === 'file')
}

async function getOrCreateSharedLink(token: string, path: string): Promise<string | null> {
  const res = await fetch(
    'https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path,
        settings: { requested_visibility: 'public' },
      }),
    }
  )
  const data = await res.json() as DropboxSharedLink
  return (
    data.url ??
    data.shared_link_already_exists?.metadata?.url ??
    null
  )
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email)
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const supabase = getSupabaseAdmin()
  const { data: user } = await supabase
    .from('users')
    .select('id, dropbox_access_token, dropbox_refresh_token')
    .eq('email', session.user.email)
    .single()

  if (!user?.dropbox_access_token) {
    return NextResponse.json({ error: 'Dropbox não conectado' }, { status: 400 })
  }

  const { folder_path, ad_names } = await req.json() as {
    folder_path: string
    ad_names: string[]
  }

  let token = user.dropbox_access_token as string

  // Listar arquivos — tentar refresh se falhar
  let files = await listDropboxFolder(token, folder_path)

  if (!files && user.dropbox_refresh_token) {
    const newToken = await refreshDropboxToken(user.dropbox_refresh_token as string)
    if (newToken) {
      token = newToken
      await supabase
        .from('users')
        .update({ dropbox_access_token: newToken })
        .eq('id', user.id)
      files = await listDropboxFolder(token, folder_path)
    }
  }

  if (!files) {
    return NextResponse.json({ error: 'Não foi possível listar a pasta do Dropbox' }, { status: 500 })
  }

  const matches: { ad_name: string; dropbox_url: string; dropbox_direct_url: string }[] = []

  for (const file of files) {
    const fileNorm = normalizeForMatch(file.name)

    const matchedAd = ad_names.find((adName) => normalizeForMatch(adName) === fileNorm)

    if (!matchedAd) continue

    const sharedUrl = await getOrCreateSharedLink(token, file.path_lower)
    if (!sharedUrl) continue

    const directUrl = convertSharedLinkToEmbed(sharedUrl)
    matches.push({ ad_name: matchedAd, dropbox_url: sharedUrl, dropbox_direct_url: directUrl })
  }

  if (matches.length > 0) {
    await supabase.from('creative_links').upsert(
      matches.map((m) => ({
        user_id: user.id,
        ad_name: m.ad_name,
        dropbox_url: m.dropbox_url,
        dropbox_direct_url: m.dropbox_direct_url,
      })),
      { onConflict: 'user_id,ad_name' }
    )
  }

  return NextResponse.json({
    matched: matches.length,
    total_files: files.length,
    matches: matches.map((m) => m.ad_name),
  })
}

// Listar pastas disponíveis no Dropbox
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.email)
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const supabase = getSupabaseAdmin()
  const { data: user } = await supabase
    .from('users')
    .select('id, dropbox_access_token, dropbox_refresh_token')
    .eq('email', session.user.email)
    .single()

  if (!user?.dropbox_access_token)
    return NextResponse.json({ error: 'Dropbox não conectado' }, { status: 400 })

  const { searchParams } = new URL(req.url)
  const path = searchParams.get('path') ?? ''

  let token = user.dropbox_access_token as string

  const tryList = async (t: string) => {
    const res = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, recursive: false }),
    })
    return res.json() as Promise<{ entries?: DropboxEntry[]; error_summary?: string }>
  }

  let data = await tryList(token)

  // Token expirado — tenta refresh
  if (data.error_summary && user.dropbox_refresh_token) {
    const newToken = await refreshDropboxToken(user.dropbox_refresh_token as string)
    if (newToken) {
      token = newToken
      await supabase.from('users').update({ dropbox_access_token: newToken }).eq('id', user.id)
      data = await tryList(token)
    }
  }

  if (data.error_summary) {
    return NextResponse.json({ error: data.error_summary }, { status: 500 })
  }

  const folders = (data.entries ?? [])
    .filter((e) => e['.tag'] === 'folder')
    .map((e) => ({ name: e.name, path: e.path_lower }))

  return NextResponse.json({ folders })
}
