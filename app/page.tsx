import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/auth-service'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const user = await getSessionUser()
  if (!user) {
    redirect('/login')
  }
  redirect('/dashboard')
}
