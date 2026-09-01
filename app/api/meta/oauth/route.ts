import { NextResponse } from 'next/server'

export async function GET() {
  const clientId = process.env.FACEBOOK_CLIENT_ID!
  const baseUrl = process.env.NEXTAUTH_URL || 'https://aduploader-iota.vercel.app'
  const redirectUri = `${baseUrl}/api/meta/callback`

  const url = new URL('https://www.facebook.com/v21.0/dialog/oauth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('scope', 'ads_management,ads_read,business_management')
  url.searchParams.set('response_type', 'code')

  return NextResponse.redirect(url.toString())
}
