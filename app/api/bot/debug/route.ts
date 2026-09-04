import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  const userEmail = process.env.AUTH_EMAIL!
  const version = process.env.META_API_VERSION || 'v21.0'

  const { data: user } = await getSupabaseAdmin()
    .from('users')
    .select('facebook_access_token')
    .eq('email', userEmail)
    .single()

  if (!user?.facebook_access_token) return NextResponse.json({ error: 'no token' })

  const token = user.facebook_access_token as string

  const { data: accounts } = await getSupabaseAdmin()
    .from('ad_accounts')
    .select('meta_account_id, name')
    .limit(5)

  const results = await Promise.all((accounts ?? []).map(async (acc) => {
    const id = acc.meta_account_id.startsWith('act_') ? acc.meta_account_id : `act_${acc.meta_account_id}`

    // Teste 1: filtering com operator IN
    const f1 = encodeURIComponent(JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE'] }]))
    const url1 = `https://graph.facebook.com/${version}/${id}/campaigns?filtering=${f1}&fields=id&limit=500&access_token=${token}`
    const r1 = await fetch(url1, { cache: 'no-store' }).then(r => r.json()).catch(e => ({ error: String(e) }))

    // Teste 2: effective_status direto na URL
    const url2 = `https://graph.facebook.com/${version}/${id}/campaigns?effective_status=%5B%22ACTIVE%22%5D&fields=id&limit=500&access_token=${token}`
    const r2 = await fetch(url2, { cache: 'no-store' }).then(r => r.json()).catch(e => ({ error: String(e) }))

    return {
      account: acc.name,
      id,
      test1_filtering_IN: r1.error ? r1 : { count: r1.data?.length, api_error: r1.error },
      test2_effective_status: r2.error ? r2 : { count: r2.data?.length, api_error: r2.error },
    }
  }))

  return NextResponse.json(results)
}
