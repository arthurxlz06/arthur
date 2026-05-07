import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getBusinessManagers, getAdAccountsByBM, getClientAdAccounts } from '@/lib/facebook'

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { data: user, error } = await getSupabaseAdmin()
    .from('users')
    .select('id, facebook_access_token')
    .eq('email', session.user.email)
    .single()

  if (error || !user?.facebook_access_token) {
    return NextResponse.json({ error: 'Token não encontrado' }, { status: 400 })
  }

  try {
    const businesses = await getBusinessManagers(user.facebook_access_token as string)

    const { data: connected } = await getSupabaseAdmin()
      .from('business_managers')
      .select('meta_bm_id')
      .eq('user_id', user.id)

    const connectedIds = new Set(connected?.map((b) => b.meta_bm_id) ?? [])

    return NextResponse.json({
      businesses: businesses.map((bm) => ({
        ...bm,
        is_connected: connectedIds.has(bm.id),
      })),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { bm_id, bm_name } = await req.json()

  const { data: user } = await getSupabaseAdmin()
    .from('users')
    .select('id, facebook_access_token')
    .eq('email', session.user.email)
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

  // Fetch owned, partner-shared, and personal ad accounts in parallel
  const [owned, client] = await Promise.all([
    getAdAccountsByBM(bm_id, user.facebook_access_token as string),
    getClientAdAccounts(bm_id, user.facebook_access_token as string),
  ])

  const unique = Array.from(
    new Map([...owned, ...client].map((a) => [a.id, a])).values()
  )

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
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { bm_id } = await req.json()

  const { data: user } = await getSupabaseAdmin()
    .from('users')
    .select('id')
    .eq('email', session.user.email)
    .single()

  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  await getSupabaseAdmin()
    .from('business_managers')
    .delete()
    .eq('user_id', user.id)
    .eq('meta_bm_id', bm_id)

  return NextResponse.json({ success: true })
}
