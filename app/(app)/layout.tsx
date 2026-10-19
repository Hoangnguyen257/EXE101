import { cookies } from 'next/headers'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app/app-sidebar'
import { AppHeader } from '@/components/app/app-header'
import { AppProvider } from '@/components/app/app-provider'
import { getAlerts, getCurrentUser, getCustomers, getSearchIndex, getShipments, getUsers } from '@/lib/data'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [cookieStore, searchIndex, shipments, customers, currentUser, users, alerts] = await Promise.all([
    cookies(),
    getSearchIndex(),
    getShipments(),
    getCustomers(),
    getCurrentUser(),
    getUsers(),
    getAlerts(),
  ])
  const sidebarOpen = cookieStore.get('sidebar_state')?.value !== 'false'

  return (
    <AppProvider searchIndex={searchIndex} shipments={shipments} customers={customers} currentUser={currentUser} users={users}>
      <SidebarProvider defaultOpen={sidebarOpen}>
        <AppSidebar alertCount={alerts.filter((a) => a.severity === 'high').length} />
        <SidebarInset>
          <AppHeader />
          <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 md:p-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </AppProvider>
  )
}
