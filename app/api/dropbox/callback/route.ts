import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(req: Request) {
  const session = await auth()
  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

  if (!session?.user?.email) {
    return NextResponse.redirect(`${baseUrl}/login`)
  }

  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(`${baseUrl}/settings?dropbox=error`)
  }

  const tokenRes = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: process.env.DROPBOX_APP_KEY!,
      client_secret: process.env.DROPBOX_APP_SECRET!,
      redirect_uri: `${baseUrl}/api/dropbox/callback`,
    }),
  })

  const tokenData = await tokenRes.json() as {
    access_token?: string
    refresh_token?: string
    error?: string
  }

  if (!tokenData.access_token) {
    return NextResponse.redirect(`${baseUrl}/creatives?dropbox=error`)
  }

  await getSupabaseAdmin()
    .from('users')
    .update({
      dropbox_access_token: tokenData.access_token,
      dropbox_refresh_token: tokenData.refresh_token ?? null,
    })
    .eq('email', session.user.email)

  return NextResponse.redirect(`${baseUrl}/settings?dropbox=connected`)
}
