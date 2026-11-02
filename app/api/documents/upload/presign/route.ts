import { NextResponse } from 'next/server'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { getSessionUser, SESSION_COOKIE_NAME } from '@/lib/auth/auth-service'
import { PermissionService } from '@/lib/auth/permission-service'
import { validateCsrf } from '@/lib/security/csrf'
import { ALLOWED_EXTENSIONS, MAX_FILE_SIZE, sanitizeFileName } from '@/lib/storage/document-storage'
import { getStorageProvider, generateStorageKey } from '@/lib/storage/storage-provider'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const csrf = validateCsrf(req)
  if (!csrf.valid) {
    return NextResponse.json({ error: csrf.error }, { status: 403 })
  }

  const authHeader = req.headers.get('authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined
  const cookieHeader = req.headers.get('cookie')
  const cookieToken = cookieHeader?.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`))?.split('=')[1]
  const sessionUser = await getSessionUser(bearerToken || cookieToken)
  if (!sessionUser) {
    return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const {
      shipmentId,
      fileName,
      fileSizeBytes,
      mimeType,
      docType = 'OTHER',
      customTypeName = '',
      docDate = new Date().toISOString().slice(0, 10),
    } = body

    if (!shipmentId) {
      return NextResponse.json({ error: 'Vui lòng chọn lô hàng liên kết.' }, { status: 400 })
    }

    if (!fileName || !fileSizeBytes || !mimeType) {
      return NextResponse.json({ error: 'Thông tin tập tin tải lên không đầy đủ.' }, { status: 400 })
    }

    // 1. Kiểm tra phần mở rộng và kích thước
    const ext = path.extname(fileName).toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `Định dạng ${ext} không được hỗ trợ. Chỉ chấp nhận .pdf, .jpg, .jpeg, .png` },
        { status: 400 }
      )
    }

    if (fileSizeBytes > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Dung lượng tập tin (${(fileSizeBytes / (1024 * 1024)).toFixed(1)}MB) vượt quá ngưỡng cho phép (25MB).` },
        { status: 400 }
      )
    }

    // 2. Kiểm tra quyền UPLOAD trên lô hàng
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { participants: true },
    })

    if (!shipment) {
      return NextResponse.json({ error: 'Lô hàng không tồn tại.' }, { status: 404 })
    }

    if (!shipment.departmentId) {
      return NextResponse.json(
        { error: 'Lô hàng chưa có phòng ban trực thuộc. Không thể khởi tạo phiên tải lên.' },
        { status: 400 }
      )
    }

    const perm = await PermissionService.check(sessionUser, 'DOCUMENTS', 'UPLOAD', {
      departmentId: shipment.departmentId,
      ownerId: shipment.ownerId,
      assignedUserIds: shipment.participants.map((p) => p.userId),
    })

    if (!perm.allowed) {
      return NextResponse.json(
        { error: perm.reason || 'Bạn không có quyền tải chứng từ lên lô hàng này.' },
        { status: 403 }
      )
    }

    // 3. Khóa lưu trữ an toàn do server sinh
    const storageKey = generateStorageKey({ extension: ext })
    const provider = getStorageProvider()

    // 4. Sinh URL tải lên có chữ ký (Presigned URL)
    const presigned = await provider.createUploadUrl(storageKey, {
      mimeType,
      maxSizeBytes: fileSizeBytes,
      expiresInSeconds: 900, // 15 phút cho thao tác upload
    })

    // 5. Ghi nhận PendingUpload (hạn chót xác nhận trong 24 giờ)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const pendingUpload = await prisma.pendingUpload.create({
      data: {
        orgId: sessionUser.orgId,
        shipmentId: shipment.id,
        storageKey,
        fileName: fileName, // Giữ tên gốc riêng để hiển thị, storageKey do server sinh
        fileSizeBytes,
        mimeType,
        docType,
        customTypeName: customTypeName || null,
        docDate,
        uploadedBy: sessionUser.id,
        expiresAt,
      },
    })

    return NextResponse.json({
      success: true,
      pendingUploadId: pendingUpload.id,
      storageKey,
      uploadUrl: presigned.uploadUrl,
      method: presigned.method,
      headers: presigned.headers,
      driver: provider.driver,
      expiresInSeconds: presigned.expiresInSeconds,
    })
  } catch (error: any) {
    console.error('Presign Upload Error:', error)
    return NextResponse.json(
      { error: error?.message || 'Không thể tạo URL tải lên tập tin.' },
      { status: 500 }
    )
  }
}

