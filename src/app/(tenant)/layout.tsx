import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NavTenant } from '@/components/nav-tenant'

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return (
      <div className="flex min-h-screen">
        <NavTenant unreadCount={1} unitLabel="Unit 1A" fullName="Sarah Johnson" />
        <main className="flex-1 lg:ml-56 pb-20 lg:pb-6 px-4 py-6 max-w-3xl mx-auto w-full">
          {children}
        </main>
      </div>
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, units(label)')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'tenant') redirect('/login')

  const { count: unreadCount } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('read_at', null)

  const unitLabel = (profile.units as { label: string } | null)?.label ?? 'Your Unit'

  return (
    <div className="flex min-h-screen">
      <NavTenant
        unreadCount={unreadCount ?? 0}
        unitLabel={unitLabel}
        fullName={profile.full_name}
      />
      <main className="flex-1 lg:ml-56 pb-20 lg:pb-6 px-4 py-6 max-w-3xl mx-auto w-full">
        {children}
      </main>
    </div>
  )
}
