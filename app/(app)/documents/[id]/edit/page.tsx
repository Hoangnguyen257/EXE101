import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ShieldAlertIcon, ArrowLeftIcon } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth/auth-service'
import { PermissionService } from '@/lib/auth/permission-service'
import { DocEditorShell } from '@/components/editor/doc-editor-shell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Soạn thảo & Chỉnh sửa chứng từ' }

export default async function DocEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    redirect('/login')
  }

  // 1. Trường hợp tạo chứng từ mới sau khi quét OCR
  if (id === 'new') {
    const canCreate = await PermissionService.check(sessionUser, 'DOCUMENTS', 'UPLOAD')
    if (!canCreate.allowed) {
      return (
        <div className="flex flex-1 items-center justify-center p-6">
          <Card className="max-w-md border-destructive/30">
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <ShieldAlertIcon className="size-6" />
              </div>
              <CardTitle className="text-lg">Không có quyền tải lên chứng từ</CardTitle>
              <CardDescription>
                Tài khoản của bạn ({sessionUser.role}) không được phân quyền tải lên hoặc tạo chứng từ mới trên hệ thống.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Link href="/documents">
                <Button variant="outline">
                  <ArrowLeftIcon className="mr-2 size-4" /> Quay lại danh sách
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      )
    }

    return <DocEditorShell docId="new" />
  }

  // 2. Trường hợp chỉnh sửa chứng từ đã tồn tại trong CSDL
  const doc = await prisma.document.findUnique({
    where: { id },
    include: {
      shipment: { include: { participants: true } },
      versions: { orderBy: { versionNumber: 'desc' } },
    },
  })

  if (!doc || doc.isDeleted) {
    notFound()
  }

  // Kiểm tra quyền EDIT phía server
  const perm = await PermissionService.check(sessionUser, 'DOCUMENTS', 'EDIT', {
    id: doc.id,
    departmentId: doc.departmentId,
    createdBy: doc.createdBy,
    ownerId: doc.shipment?.ownerId,
    assignedUserIds: doc.shipment?.participants?.map((p) => p.userId),
  })

  if (!perm.allowed) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <Card className="max-w-md border-destructive/30">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <ShieldAlertIcon className="size-6" />
            </div>
            <CardTitle className="text-lg">Từ chối truy cập (403 Forbidden)</CardTitle>
            <CardDescription>
              {perm.reason || 'Bạn không có quyền chỉnh sửa chứng từ này theo chính sách bảo vệ dữ liệu phòng ban.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center gap-3">
            <Link href={`/documents/${doc.id}`}>
              <Button variant="outline">
                <ArrowLeftIcon className="mr-2 size-4" /> Xem chi tiết chứng từ
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const versionsList = doc.versions.map((v) => ({
    versionNumber: v.versionNumber,
    fileName: v.fileName,
    uploadedAt: v.uploadedAt.toISOString(),
    changeNote: v.changeNote || '',
  }))

  return (
    <DocEditorShell
      docId={doc.id}
      initialTitle={doc.title}
      initialHtml={doc.editedHtml || ''}
      versions={versionsList}
    />
  )
}
