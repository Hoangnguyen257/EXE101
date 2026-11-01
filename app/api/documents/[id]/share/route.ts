import { NextResponse } from 'next/server'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth/auth-service'
import { PermissionService } from '@/lib/auth/permission-service'
import { validateCsrf } from '@/lib/security/csrf'

/**
 * Tạo token ngẫu nhiên bảo mật cao (192-bit cryptographic entropy)
 */
function generateSecureToken() {
  return crypto.randomBytes(24).toString('base64url')
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  }

  // Permission check
  const doc = await prisma.document.findUnique({
    where: { id },
  })

  if (!doc || doc.isDeleted) {
    return NextResponse.json({ error: 'Chứng từ không tồn tại.' }, { status: 404 })
  }

  const perm = await PermissionService.check(sessionUser, 'DOCUMENTS', 'SHARE', {
    id: doc.id,
    departmentId: doc.departmentId,
    createdBy: doc.createdBy,
  })

  if (!perm.allowed) {
    return NextResponse.json({ error: perm.reason || 'Bạn không có quyền xem thông tin chia sẻ của chứng từ này.' }, { status: 403 })
  }

  const shares = await prisma.documentShare.findMany({
    where: { documentId: id, isRevoked: false },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    shares: shares.map((s) => ({
      id: s.id,
      documentId: s.documentId,
      token: s.token,
      expiresAt: s.expiresAt.toISOString(),
      hasPassword: !!s.passwordHash,
      createdBy: s.createdBy,
      createdAt: s.createdAt.toISOString(),
      views: s.viewCount,
      allowDownload: s.allowDownload,
    })),
  })
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const csrf = validateCsrf(req)
  if (!csrf.valid) {
    return NextResponse.json({ error: csrf.error }, { status: 403 })
  }

  const { id } = await params
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  }

  const doc = await prisma.document.findUnique({
    where: { id },
  })

  if (!doc || doc.isDeleted) {
    return NextResponse.json({ error: 'Chứng từ không tồn tại.' }, { status: 404 })
  }

  // Permission check
  const perm = await PermissionService.check(sessionUser, 'DOCUMENTS', 'SHARE', {
    id: doc.id,
    departmentId: doc.departmentId,
    createdBy: doc.createdBy,
  })

  if (!perm.allowed) {
    return NextResponse.json({ error: perm.reason || 'Bạn không có quyền chia sẻ chứng từ này.' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { expiryDays = 7, password, allowDownload = true, maxViews } = body

    const token = generateSecureToken()
    const expiresAt = new Date(Date.now() + Math.max(1, Number(expiryDays)) * 86400000)
    let passwordHash = null

    if (password && password.trim()) {
      passwordHash = await bcrypt.hash(password.trim(), 10)
    }

    const share = await prisma.documentShare.create({
      data: {
        documentId: doc.id,
        token,
        passwordHash,
        expiresAt,
        allowDownload: Boolean(allowDownload),
        maxViews: maxViews ? Number(maxViews) : null,
        createdBy: sessionUser.id,
      },
    })

    // Audit Log
    await prisma.auditLog.create({
      data: {
        orgId: sessionUser.orgId,
        userId: sessionUser.id,
        action: 'share',
        resourceType: 'document',
        resourceId: doc.id,
        status: 'SUCCESS',
        diffJson: JSON.stringify({ token, expiresAt, hasPassword: !!passwordHash }),
      },
    })

    return NextResponse.json({
      success: true,
      share: {
        id: share.id,
        token: share.token,
        expiresAt: share.expiresAt.toISOString(),
        hasPassword: !!share.passwordHash,
        allowDownload: share.allowDownload,
        views: share.viewCount,
      },
    })
  } catch (error: any) {
    console.error('Lỗi tạo liên kết chia sẻ:', error)
    return NextResponse.json({ error: 'Lỗi tạo liên kết chia sẻ.' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const csrf = validateCsrf(req)
  if (!csrf.valid) {
    return NextResponse.json({ error: csrf.error }, { status: 403 })
  }

  const { id } = await params
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  }

  const doc = await prisma.document.findUnique({
    where: { id },
  })

  if (!doc) {
    return NextResponse.json({ error: 'Chứng từ không tồn tại.' }, { status: 404 })
  }

  const perm = await PermissionService.check(sessionUser, 'DOCUMENTS', 'SHARE', {
    id: doc.id,
    departmentId: doc.departmentId,
    createdBy: doc.createdBy,
  })

  if (!perm.allowed) {
    return NextResponse.json({ error: 'Bạn không có quyền thu hồi liên kết chia sẻ của chứng từ này.' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const shareId = searchParams.get('shareId')

    if (!shareId) {
      return NextResponse.json({ error: 'Thiếu mã liên kết' }, { status: 400 })
    }

    const targetShare = await prisma.documentShare.findUnique({
      where: { id: shareId },
    })

    if (!targetShare || targetShare.documentId !== doc.id) {
      return NextResponse.json({ error: 'Liên kết không thuộc tài liệu này.' }, { status: 404 })
    }

    await prisma.documentShare.update({
      where: { id: shareId },
      data: { isRevoked: true },
    })

    // Audit Log
    await prisma.auditLog.create({
      data: {
        orgId: sessionUser.orgId,
        userId: sessionUser.id,
        action: 'share',
        resourceType: 'document',
        resourceId: doc.id,
        status: 'SUCCESS',
        diffJson: JSON.stringify({ revokedShareId: shareId }),
      },
    })

    return NextResponse.json({ success: true, message: 'Đã thu hồi liên kết chia sẻ.' })
  } catch {
    return NextResponse.json({ error: 'Lỗi thu hồi liên kết.' }, { status: 500 })
  }
}
