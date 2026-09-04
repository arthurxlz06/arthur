const BASE_URL = `https://graph.facebook.com/${process.env.META_API_VERSION || 'v21.0'}`

interface MetaBusiness {
  id: string
  name: string
}

interface MetaAdAccount {
  id: string
  name: string
  account_status: number
  account_id: string
}

interface MetaApiError {
  message: string
  type: string
  code: number
}

async function metaFetch<T>(url: string, retries = 3): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url, { cache: 'no-store' })
    const data = await res.json()

    if (data.error) {
      const err: MetaApiError = data.error
      if (err.code === 17 || err.code === 4) {
        const wait = Math.pow(2, attempt) * 1000
        await new Promise((r) => setTimeout(r, wait))
        continue
      }
      throw new Error(`Meta API Error ${err.code}: ${err.message}`)
    }

    return data as T
  }
  throw new Error('Meta API: máximo de tentativas atingido')
}

export async function getBusinessManagers(accessToken: string): Promise<MetaBusiness[]> {
  const data = await metaFetch<{ data: MetaBusiness[] }>(
    `${BASE_URL}/me/businesses?fields=id,name&access_token=${accessToken}`
  )
  return data.data
}

export async function getAdAccountsByBM(
  bmId: string,
  accessToken: string
): Promise<MetaAdAccount[]> {
  const data = await metaFetch<{ data: MetaAdAccount[] }>(
    `${BASE_URL}/${bmId}/owned_ad_accounts?fields=id,name,account_status,account_id&access_token=${accessToken}`
  )
  return data.data
}

export async function getClientAdAccounts(
  bmId: string,
  accessToken: string
): Promise<MetaAdAccount[]> {
  const data = await metaFetch<{ data: MetaAdAccount[] }>(
    `${BASE_URL}/${bmId}/client_ad_accounts?fields=id,name,account_status&access_token=${accessToken}`
  )
  return data.data
}


export async function getPersonalAdAccounts(accessToken: string): Promise<MetaAdAccount[]> {
  try {
    const data = await metaFetch<{ data: MetaAdAccount[] }>(
      `${BASE_URL}/me/adaccounts?fields=id,name,account_status,account_id&access_token=${accessToken}`
    )
    return data.data ?? []
  } catch {
    return []
  }
}

export async function getActiveCampaignCount(accountId: string, accessToken: string): Promise<number> {
  try {
    const id = accountId.startsWith('act_') ? accountId : `act_${accountId}`
    const today = new Date().toISOString().split('T')[0]

    // Insights só retorna campanhas com atividade — filtramos spend > 0 no cliente
    const params = new URLSearchParams({
      level: 'campaign',
      fields: 'campaign_id,spend',
      time_range: JSON.stringify({ since: today, until: today }),
      limit: '500',
      access_token: accessToken,
    })

    let count = 0
    let after: string | undefined
    do {
      if (after) params.set('after', after)
      const data = await metaFetch<{
        data: { campaign_id: string; spend: string }[]
        paging?: { cursors?: { after?: string }; next?: string }
      }>(`${BASE_URL}/${id}/insights?${params}`)
      count += (data.data ?? []).filter(d => parseFloat(d.spend || '0') > 0).length
      after = data.paging?.cursors?.after
      if (!after && data.paging?.next) {
        try { after = new URL(data.paging.next).searchParams.get('after') ?? undefined } catch { /* ignore */ }
      }
    } while (after)

    return count
  } catch {
    return 0
  }
}

export async function validateToken(accessToken: string): Promise<boolean> {
  try {
    await metaFetch(`${BASE_URL}/me?fields=id&access_token=${accessToken}`)
    return true
  } catch {
    return false
  }
}
