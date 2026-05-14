import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { getSupabaseAdmin } from '@/lib/supabase'

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        const email = (credentials?.email as string | undefined)?.toLowerCase().trim()
        const password = credentials?.password as string | undefined
        if (!email || !password) return null
        if (email !== process.env.AUTH_EMAIL?.toLowerCase() || password !== process.env.AUTH_PASSWORD) return null

        const { data: user } = await getSupabaseAdmin()
          .from('users')
          .select('id, email, name, avatar_url')
          .eq('email', email)
          .single()

        if (!user) return null
        return { id: user.id as string, email: user.email as string, name: user.name as string | null, image: user.avatar_url as string | null }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    session({ session, token }) {
      if (session.user) session.user.id = token.id as string
      return session
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: { strategy: 'jwt' },
})
