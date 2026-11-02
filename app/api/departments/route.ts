import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth/auth-service'
import { PermissionService } from '@/lib/auth/permission-service'

/**
 * GET /api/departments
 * Lấy danh sách phòng ban trong tổ chức
 */
export async function GET(req: Request) {
  try {
    const sessionUser = await getSessionUser(req)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Chưa đăng nhập (Unauthenticated).' }, { status: 401 })
    }

    const perm = await PermissionService.check(sessionUser, 'DEPARTMENTS', 'VIEW')
    if (!perm.allowed) {
      return NextResponse.json({ error: perm.reason || 'Bạn không có quyền xem danh sách phòng ban.' }, { status: 403 })
    }

    const departments = await prisma.department.findMany({
      where: { orgId: sessionUser.orgId },
      include: {
        userLinks: {
          include: {
            user: { select: { id: true, name: true, email: true, roleCode: true } },
          },
        },
        _count: {
          select: {
            shipments: true,
            documents: true,
          },
        },
      },
      orderBy: { code: 'asc' },
    })

    return NextResponse.json({ departments })
  } catch (error: any) {
    console.error('Lỗi GET /api/departments:', error)
    return NextResponse.json({ error: 'Lỗi máy chủ khi lấy danh sách phòng ban.' }, { status: 500 })
  }
}

/**
 * POST /api/departments
 * Tạo phòng ban mới (Chỉ ADMIN)
 */
export async function POST(req: Request) {
  try {
    const sessionUser = await getSessionUser(req)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Chưa đăng nhập (Unauthenticated).' }, { status: 401 })
    }

    const perm = await PermissionService.check(sessionUser, 'DEPARTMENTS', 'CREATE')
    if (!perm.allowed) {
      return NextResponse.json({ error: perm.reason || 'Chỉ Quản trị viên (ADMIN) mới có quyền tạo phòng ban.' }, { status: 403 })
    }

    const body = await req.json()
    const { code, name, headUserId } = body

    if (!code || typeof code !== 'string' || code.trim().length < 2) {
      return NextResponse.json({ error: 'Mã phòng ban phải có ít nhất 2 ký tự.' }, { status: 400 })
    }

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json({ error: 'Tên phòng ban phải có ít nhất 2 ký tự.' }, { status: 400 })
    }

    const normalizedCode = code.trim().toUpperCase()

    // Kiểm tra trùng mã trong tổ chức
    const existing = await prisma.department.findUnique({
      where: {
        orgId_code: {
          orgId: sessionUser.orgId,
          code: normalizedCode,
        },
      },
    })
    if (existing) {
      return NextResponse.json({ error: `Mã phòng ban "${normalizedCode}" đã tồn tại trong tổ chức.` }, { status: 409 })
    }

    if (headUserId) {
      const headUser = await prisma.user.findFirst({
        where: { id: headUserId, orgId: sessionUser.orgId },
      })
      if (!headUser) {
        return NextResponse.json({ error: 'Trưởng phòng được chỉ định không tồn tại.' }, { status: 400 })
      }
    }

    const dept = await prisma.department.create({
      data: {
        orgId: sessionUser.orgId,
        code: normalizedCode,
        name: name.trim(),
        headUserId: headUserId || null,
        isActive: true,
      },
    })

    await prisma.auditLog.create({
      data: {
        orgId: sessionUser.orgId,
        userId: sessionUser.id,
        action: 'create',
        resourceType: 'department',
        resourceId: dept.id,
        status: 'SUCCESS',
        diffJson: JSON.stringify({ code: dept.code, name: dept.name, headUserId }),
      },
    })

    return NextResponse.json(
      {
        success: true,
        department: dept,
        message: 'Tạo phòng ban mới thành công.',
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Lỗi POST /api/departments:', error)
    return NextResponse.json({ error: 'Lỗi máy chủ khi tạo phòng ban.' }, { status: 500 })
  }
}
