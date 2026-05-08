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

function toWords(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/\.[^/.]+$/, '')          // remove extensão
    .replace(/[_\-\.\[\](){}]/g, ' ')  // separadores → espaço
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w.length >= 3)
}

function wordsOverlap(a: string[], b: string[]): boolean {
  const setB = new Set(b.filter((w) => w.length >= 5))
  return a.some((w) => w.length >= 5 && setB.has(w))
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
  let data: DropboxSharedLink
  try {
    data = await res.json() as DropboxSharedLink
  } catch {
    return null
  }
  return (
    data.url ??
    data.shared_link_already_exists?.metadata?.url ??
    null
  )
}

export async function POST(req: Request) {
  try {
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
      return NextResponse.json({ error: 'Dropbox não conectado. Reconecte em Configurações.' }, { status: 400 })
    }

    const body = await req.json() as { folder_path: string; ad_names: string[]; name_filter?: string }
    const { folder_path, ad_names, name_filter } = body

    let token = user.dropbox_access_token as string

    // Listar arquivos — tentar refresh se falhar
    let files = await listDropboxFolder(token, folder_path)

    if (!files && user.dropbox_refresh_token) {
      const newToken = await refreshDropboxToken(user.dropbox_refresh_token as string)
      if (newToken) {
        token = newToken
        await supabase.from('users').update({ dropbox_access_token: newToken }).eq('id', user.id)
        files = await listDropboxFolder(token, folder_path)
      }
    }

    if (!files) {
      return NextResponse.json({
        error: `Não foi possível listar a pasta "${folder_path}". Verifique se o Dropbox está conectado corretamente em Configurações e se a pasta existe.`
      }, { status: 500 })
    }

    const matches: { ad_name: string; dropbox_url: string; dropbox_direct_url: string }[] = []

    // Filtra arquivos do Dropbox pelo name_filter se fornecido
    const filterKeyword = (name_filter ?? '').toLowerCase().trim()
    const filesToMatch = filterKeyword
      ? files.filter((f) => f.name.toLowerCase().includes(filterKeyword))
      : files

    // Pré-processa os ad_names
    const processedAds = ad_names.map((n) => ({ original: n, words: toWords(n) }))

    for (const file of filesToMatch) {
      const fileWords = toWords(file.name)
      if (fileWords.length === 0) continue

      // Encontra o ad_name que tem mais palavras significativas em comum
      let matchedAd: string | undefined

      // 1ª: match exato de palavras
      matchedAd = processedAds.find((a) =>
        fileWords.join(' ') === a.words.join(' ')
      )?.original

      // 2ª: overlap de palavras significativas (>= 5 letras)
      if (!matchedAd) {
        matchedAd = processedAds.find((a) => wordsOverlap(fileWords, a.words))?.original
      }

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

    const fileSample = filesToMatch.slice(0, 5).map((f) => f.name.replace(/\.[^/.]+$/, ''))
    const adSample = ad_names.slice(0, 8)

    return NextResponse.json({
      matched: matches.length,
      total_files: filesToMatch.length,
      matches: matches.map((m) => m.ad_name),
      debug_files: fileSample,
      debug_ads: adSample,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Erro interno: ${msg}` }, { status: 500 })
  }
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
