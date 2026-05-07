const BASE_URL = `https://graph.facebook.com/${process.env.META_API_VERSION}`

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
    const res = await fetch(url)
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


export async function validateToken(accessToken: string): Promise<boolean> {
  try {
    await metaFetch(`${BASE_URL}/me?fields=id&access_token=${accessToken}`)
    return true
  } catch {
    return false
  }
}
