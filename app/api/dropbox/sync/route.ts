import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabaseAdmin } from '@/lib/supabase'

interface DropboxEntry {
  '.tag': string
  name: string
  path_lower: string
}


// Extrai tokens significativos: ao menos 4 chars e NÃO puramente numérico
function getTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/\.[^/.]+$/, '')             // remove extensão
    .replace(/[_\-\.\[\](){}]/g, ' ')     // separadores → espaço
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w.length >= 4 && !/^\d+$/.test(w))
}

// Conta quantos tokens do arquivo aparecem como substring no nome do anúncio
function scoreMatch(fileTokens: string[], adName: string): number {
  const adLower = adName.toLowerCase()
  return fileTokens.reduce((n, t) => n + (adLower.includes(t) ? 1 : 0), 0)
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

async function getTemporaryLink(token: string, path: string): Promise<string | null> {
  try {
    const res = await fetch('https://api.dropboxapi.com/2/files/get_temporary_link', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    })
    const data = await res.json() as { link?: string }
    return data.link ?? null
  } catch {
    return null
  }
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

    // Filtro por keyword (se fornecido)
    const filterKeyword = (name_filter ?? '').toLowerCase().trim()
    const filesToMatch = filterKeyword
      ? files.filter((f) => f.name.toLowerCase().includes(filterKeyword))
      : files

    // Pré-processa tokens dos ad_names
    const processedAds = ad_names.map((n) => ({ original: n, tokens: getTokens(n) }))

    const matches: { ad_name: string; dropbox_url: string; dropbox_direct_url: string }[] = []
    let nameMatchCount = 0
    let linkFailCount = 0

    const firstFileTokens = filesToMatch.length > 0 ? getTokens(filesToMatch[0].name) : []
    const firstAdTokens = ad_names.length > 0 ? getTokens(ad_names[0]) : []
    const firstScore = firstFileTokens.length > 0 && ad_names.length > 0
      ? scoreMatch(firstFileTokens, ad_names[0])
      : -1

    for (const file of filesToMatch) {
      const fileTokens = getTokens(file.name)
      if (fileTokens.length === 0) continue

      // Encontra o ad com maior score de substring match
      let bestAd: string | undefined
      let bestScore = 0

      for (const ad of processedAds) {
        const score = scoreMatch(fileTokens, ad.original)
        if (score > bestScore) {
          bestScore = score
          bestAd = ad.original
        }
      }

      if (!bestAd || bestScore === 0) continue
      nameMatchCount++

      const directUrl = await getTemporaryLink(token, file.path_lower)
      if (!directUrl) {
        linkFailCount++
        continue
      }

      matches.push({ ad_name: bestAd, dropbox_url: directUrl, dropbox_direct_url: directUrl })
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
      total_files: filesToMatch.length,
      name_matches: nameMatchCount,
      link_fails: linkFailCount,
      matches: matches.map((m) => m.ad_name),
      debug_files: filesToMatch.slice(0, 5).map((f) => f.name.replace(/\.[^/.]+$/, '')),
      debug_ads: ad_names.slice(0, 8),
      debug_first_file_tokens: firstFileTokens,
      debug_first_ad_tokens: firstAdTokens,
      debug_first_score: firstScore,
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

  // Modo debug: tenta criar shared link para o 1º arquivo e retorna o raw
  if (searchParams.get('debug') === '1') {
    const firstFile = (data.entries ?? []).find((e) => e['.tag'] === 'file')
    if (!firstFile) return NextResponse.json({ error: 'Nenhum arquivo na pasta', entries: data.entries })
    const dbgRes = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: firstFile.path_lower }),
    })
    const dbgRaw = await dbgRes.json()
    return NextResponse.json({ file: firstFile.name, path: firstFile.path_lower, dropbox_raw: dbgRaw, http_status: dbgRes.status })
  }

  const folders = (data.entries ?? [])
    .filter((e) => e['.tag'] === 'folder')
    .map((e) => ({ name: e.name, path: e.path_lower }))

  return NextResponse.json({ folders })
}
