import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const baseUrl = process.env.NEXTAUTH_URL || 'https://aduploader-iota.vercel.app'

  if (error || !code) {
    return NextResponse.redirect(`${baseUrl}/settings?meta_error=${error ?? 'cancelled'}`)
  }

  try {
    const redirectUri = `${baseUrl}/api/meta/callback`

    // Trocar code por access_token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?` +
      `client_id=${process.env.FACEBOOK_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&client_secret=${process.env.FACEBOOK_CLIENT_SECRET}` +
      `&code=${code}`
    )
    const tokenData = await tokenRes.json() as { access_token?: string; error?: { message: string } }

    if (tokenData.error || !tokenData.access_token) {
      throw new Error(tokenData.error?.message ?? 'Token não retornado')
    }

    // Trocar por token de longa duração
    const longRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?` +
      `grant_type=fb_exchange_token` +
      `&client_id=${process.env.FACEBOOK_CLIENT_ID}` +
      `&client_secret=${process.env.FACEBOOK_CLIENT_SECRET}` +
      `&fb_exchange_token=${tokenData.access_token}`
    )
    const longData = await longRes.json() as { access_token?: string; error?: { message: string } }
    const finalToken = longData.access_token ?? tokenData.access_token

    // Salvar no Supabase
    const userEmail = process.env.AUTH_EMAIL!
    await getSupabaseAdmin()
      .from('users')
      .update({ facebook_access_token: finalToken })
      .eq('email', userEmail)

    return NextResponse.redirect(`${baseUrl}/settings?meta_connected=1`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.redirect(`${baseUrl}/settings?meta_error=${encodeURIComponent(msg)}`)
  }
}
