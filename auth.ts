import NextAuth from 'next-auth'
import Facebook from 'next-auth/providers/facebook'
import { getSupabaseAdmin } from '@/lib/supabase'

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Facebook({
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'email,ads_management,ads_read,business_management,pages_read_engagement',
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!account || account.provider !== 'facebook') return false

      const { error } = await getSupabaseAdmin()
        .from('users')
        .upsert(
          {
            email: user.email!,
            name: user.name,
            avatar_url: user.image,
            facebook_user_id: account.providerAccountId,
            facebook_access_token: account.access_token,
          },
          { onConflict: 'email' }
        )

      if (error) {
        console.error('Erro ao salvar usuário:', error)
        return false
      }

      return true
    },
    async session({ session, token }) {
      if (session.user?.email) {
        const { data } = await getSupabaseAdmin()
          .from('users')
          .select('id, facebook_user_id')
          .eq('email', session.user.email)
          .single()

        if (data) {
          session.user.id = data.id as string
          session.user.facebook_user_id = data.facebook_user_id as string | null
        }
      }
      return session
    },
    async jwt({ token, account }) {
      if (account) {
        token.access_token = account.access_token
      }
      return token
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
  },
})
