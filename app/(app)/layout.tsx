import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app/app-sidebar'
import { AppHeader } from '@/components/app/app-header'
import { AppProvider } from '@/components/app/app-provider'
import { getCurrentUser, getUsers } from '@/lib/data'
import { getSessionUser } from '@/lib/auth/auth-service'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    redirect('/login')
  }

  if (sessionUser.mustChangePassword) {
    redirect('/change-password')
  }

  // Tối ưu hóa hiệu năng (LỖI 7): Khung giao diện (Layout) chỉ nạp thông tin cần thiết:
  // - cookies cho sidebar_state
  // - currentUser & users cho thông tin phiên người dùng
  // - đếm số thông báo/cảnh báo nghiêm trọng bằng query count tối ưu
  // Tuyệt đối không nạp getSearchIndex() hay toàn bộ getShipments() ở mỗi lần chuyển trang.
  const [cookieStore, currentUser, users, alertCount] = await Promise.all([
    cookies(),
    getCurrentUser(),
    getUsers(),
    prisma.notification.count({
      where: {
        userId: sessionUser.id,
        isRead: false,
      },
    }),
  ])
  const sidebarOpen = cookieStore.get('sidebar_state')?.value !== 'false'

  return (
    <AppProvider currentUser={currentUser} users={users}>
      <SidebarProvider defaultOpen={sidebarOpen}>
        <AppSidebar alertCount={alertCount} />
        <SidebarInset>
          <AppHeader />
          <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 md:p-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </AppProvider>
  )
}
