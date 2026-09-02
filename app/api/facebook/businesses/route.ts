import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getBusinessManagers, getAdAccountsByBM, getClientAdAccounts, getPersonalAdAccounts } from '@/lib/facebook'

export async function GET() {
  const userEmail = process.env.AUTH_EMAIL!

  const { data: user, error } = await getSupabaseAdmin()
    .from('users')
    .select('id, facebook_access_token')
    .eq('email', userEmail)
    .single()

  if (error || !user?.facebook_access_token) {
    return NextResponse.json({ error: 'Token não encontrado' }, { status: 400 })
  }

  const token = user.facebook_access_token as string

  try {
    const [businesses, personalAccounts] = await Promise.all([
      getBusinessManagers(token).catch(() => [] as { id: string; name: string }[]),
      getPersonalAdAccounts(token),
    ])

    const { data: connected } = await getSupabaseAdmin()
      .from('business_managers')
      .select('meta_bm_id')
      .eq('user_id', user.id)

    const connectedIds = new Set(connected?.map((b) => b.meta_bm_id) ?? [])

    const result = businesses.map((bm) => ({
      ...bm,
      is_connected: connectedIds.has(bm.id),
      is_personal: false,
    }))

    // Adiciona entrada especial para contas pessoais (sem BM)
    if (personalAccounts.length > 0) {
      result.push({
        id: 'personal',
        name: `Contas Pessoais (${personalAccounts.length} conta${personalAccounts.length !== 1 ? 's' : ''})`,
        is_connected: connectedIds.has('personal'),
        is_personal: true,
      })
    }

    return NextResponse.json({ businesses: result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json({ error: message, businesses: [] }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const userEmail = process.env.AUTH_EMAIL!

  const { bm_id, bm_name } = await req.json()

  const { data: user } = await getSupabaseAdmin()
    .from('users')
    .select('id, facebook_access_token')
    .eq('email', userEmail)
    .single()

  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  // Check if BM already exists to avoid duplicates
  const { data: existingBM } = await getSupabaseAdmin()
    .from('business_managers')
    .select('id')
    .eq('user_id', user.id)
    .eq('meta_bm_id', bm_id)
    .maybeSingle()

  let bmDbId: string

  if (existingBM) {
    bmDbId = existingBM.id
    await getSupabaseAdmin()
      .from('business_managers')
      .update({ name: bm_name })
      .eq('id', existingBM.id)
  } else {
    const { data: newBM, error: insertError } = await getSupabaseAdmin()
      .from('business_managers')
      .insert({ user_id: user.id, meta_bm_id: bm_id, name: bm_name })
      .select('id')
      .single()

    if (insertError || !newBM) {
      return NextResponse.json({ error: insertError?.message ?? 'Erro ao criar BM' }, { status: 500 })
    }
    bmDbId = newBM.id
  }

  // Para contas pessoais usa /me/adaccounts; para BM normal usa os endpoints de BM
  let unique: { id: string; name: string; account_status: number; account_id: string }[] = []
  if (bm_id === 'personal') {
    unique = await getPersonalAdAccounts(user.facebook_access_token as string)
  } else {
    const [owned, client] = await Promise.all([
      getAdAccountsByBM(bm_id, user.facebook_access_token as string),
      getClientAdAccounts(bm_id, user.facebook_access_token as string),
    ])
    unique = Array.from(
      new Map([...owned, ...client].map((a) => [a.id, a])).values()
    )
  }

  if (unique.length > 0) {
    // Get existing accounts to preserve is_selected state
    const { data: existingAccounts } = await getSupabaseAdmin()
      .from('ad_accounts')
      .select('id, meta_account_id, is_selected')
      .eq('bm_id', bmDbId)

    const existingMap = new Map(existingAccounts?.map((a) => [a.meta_account_id, a]) ?? [])

    for (const acc of unique) {
      const existing = existingMap.get(acc.id)
      const payload = {
        bm_id: bmDbId,
        meta_account_id: acc.id,
        name: acc.name,
        status: acc.account_status === 1 ? 'active' : 'disabled',
      }

      if (existing) {
        await getSupabaseAdmin()
          .from('ad_accounts')
          .update(payload)
          .eq('id', existing.id)
      } else {
        await getSupabaseAdmin()
          .from('ad_accounts')
          .insert({ ...payload, is_selected: false })
      }
    }
  }

  return NextResponse.json({ success: true, accounts_imported: unique.length })
}

export async function DELETE(req: Request) {
  const userEmail = process.env.AUTH_EMAIL!

  const { bm_id } = await req.json()

  const { data: user } = await getSupabaseAdmin()
    .from('users')
    .select('id')
    .eq('email', userEmail)
    .single()

  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  await getSupabaseAdmin()
    .from('business_managers')
    .delete()
    .eq('user_id', user.id)
    .eq('meta_bm_id', bm_id)

  return NextResponse.json({ success: true })
}
