import { NextResponse } from 'next/server'

export async function GET() {
  const params = new URLSearchParams({
    client_id: process.env.DROPBOX_APP_KEY!,
    response_type: 'code',
    redirect_uri: `${process.env.NEXTAUTH_URL}/api/dropbox/callback`,
    token_access_type: 'offline',
    force_reapprove: 'true',
    scope: 'account_info.read files.metadata.read files.metadata.write files.content.read files.content.write sharing.read sharing.write',
  })
  return NextResponse.redirect(
    `https://www.dropbox.com/oauth2/authorize?${params}`
  )
}
