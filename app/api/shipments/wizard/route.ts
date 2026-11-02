import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth/auth-service'
import { PermissionService } from '@/lib/auth/permission-service'
import { validateCsrf } from '@/lib/security/csrf'
import {
  validateVietnameseTaxCode,
  normalizeAndValidateHsCode,
  validateRoute,
  generateShipmentRequirements,
  WizardStep1Schema,
} from '@/lib/validations/shipment-wizard'

export const dynamic = 'force-dynamic'

/**
 * Sinh mã Job chuẩn tự động theo mode và thời gian
 * Format: TML-SE2611-XXXX hoặc TML-AE2611-XXXX hoặc TML-RD2611-XXXX
 */
function generateDefaultJobNo(mode: string): string {
  const modePrefix = mode === 'air' ? 'AE' : mode === 'road' ? 'RD' : 'SE'
  const date = new Date()
  const year = String(date.getFullYear()).slice(-2)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const randomSuffix = Math.floor(1000 + Math.random() * 9000)
  return `TML-${modePrefix}${year}${month}-${randomSuffix}`
}

/**
 * GET: Lấy thông tin bản nháp hoặc nạp danh sách dữ liệu cho Wizard (Khách hàng, Phòng ban)
 */
export async function GET(req: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const shipmentId = searchParams.get('id')

  if (shipmentId) {
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        customer: true,
        goods: { orderBy: { orderIndex: 'asc' } },
        requirements: true,
        documents: {
          where: { isDeleted: false },
          include: { versions: { orderBy: { versionNumber: 'desc' } } },
        },
        participants: true,
      },
    })

    if (!shipment) {
      return NextResponse.json({ error: 'Không tìm thấy lô hàng' }, { status: 404 })
    }

    // Kiểm tra quyền
    const perm = await PermissionService.check(sessionUser, 'SHIPMENTS', 'VIEW', {
      id: shipment.id,
      departmentId: shipment.departmentId,
      ownerId: shipment.ownerId,
      assignedUserIds: shipment.participants.map((p) => p.userId),
    })

    if (!perm.allowed) {
      return NextResponse.json({ error: perm.reason || 'Không có quyền truy cập lô hàng này' }, { status: 403 })
    }

    return NextResponse.json({ shipment })
  }

  // Nếu không truyền id, trả về metadata hỗ trợ khởi tạo wizard
  const allowedDeptIds =
    sessionUser.role === 'ADMIN'
      ? (await prisma.department.findMany({ select: { id: true, name: true, code: true } }))
      : sessionUser.departments.map((d) => ({ id: d.id, name: d.name, code: d.code }))

  const customers = await prisma.customer.findMany({
    where: { orgId: sessionUser.orgId },
    select: { id: true, name: true, shortName: true, taxCode: true },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({
    allowedDepartments: allowedDeptIds,
    customers,
    suggestedJobNo: generateDefaultJobNo('sea'),
  })
}

/**
 * POST: Tạo mới hoặc cập nhật từng bước của Wizard lô hàng
 */
export async function POST(req: Request) {
  const csrf = validateCsrf(req)
  if (!csrf.valid) {
    return NextResponse.json({ error: csrf.error }, { status: 403 })
  }

  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  }

  // 1. Kiểm tra quyền tạo lô hàng: STAFF không có quyền theo ma trận Việc 3
  const perm = await PermissionService.check(sessionUser, 'SHIPMENTS', 'CREATE')
  if (!perm.allowed) {
    return NextResponse.json(
      { error: perm.reason || 'Bạn không có quyền tạo lô hàng mới. Chỉ Quản trị viên hoặc Quản lý phòng ban mới được phép.' },
      { status: 403 }
    )
  }

  try {
    const body = await req.json()
    const {
      step = 1,
      isDraftSave = false,
      finalizeLater = false,
      complete = false,
      shipmentId,
      // Bước 1
      jobNo: rawJobNo,
      departmentId,
      mode = 'sea',
      origin,
      destination,
      // Bước 2
      customerId: rawCustomerId,
      newCustomer, // { name, taxCode, shortName }
      goods = [],
      blNo,
      etd,
      eta,
      carrier,
      vessel,
      voyage,
      containerNo,
      incoterms,
      notes,
    } = body

    const jobNo = (rawJobNo || generateDefaultJobNo(mode)).trim()

    // =========================================================================
    // XỬ LÝ BƯỚC 1: KHỞI TẠO LÔ HÀNG (JobNo, Department, Mode, Origin, Destination)
    // =========================================================================
    if (step === 1 || !shipmentId) {
      if (!isDraftSave) {
        const step1Parsed = WizardStep1Schema.safeParse({
          jobNo,
          departmentId,
          mode,
          origin,
          destination,
        })

        if (!step1Parsed.success) {
          const firstErr = step1Parsed.error.issues?.[0]?.message || 'Thông tin bước 1 chưa hợp lệ'
          return NextResponse.json({ error: firstErr }, { status: 400 })
        }
      }

      // Kiểm tra phòng ban phụ trách có nằm trong quyền quản lý của user không
      if (departmentId && sessionUser.role !== 'ADMIN') {
        const isUserInDept = sessionUser.departments.some((d) => d.id === departmentId)
        if (!isUserInDept) {
          return NextResponse.json(
            { error: 'Bạn chỉ được phân công lô hàng thuộc phòng ban bạn đang phụ trách.' },
            { status: 403 }
          )
        }
      }

      // Kiểm tra trùng lặp Job Number
      const existingJob = await prisma.shipment.findUnique({
        where: { jobNo },
      })

      if (existingJob && (!shipmentId || existingJob.id !== shipmentId)) {
        return NextResponse.json(
          { error: `Số Job "${jobNo}" đã tồn tại trên hệ thống. Vui lòng nhập số Job khác.` },
          { status: 409 }
        )
      }

      // Tuyến đường
      if (origin && destination) {
        const routeCheck = validateRoute(origin, destination)
        if (!routeCheck.valid && !isDraftSave) {
          return NextResponse.json({ error: routeCheck.message }, { status: 400 })
        }
      }

      let shipment
      if (shipmentId) {
        shipment = await prisma.shipment.update({
          where: { id: shipmentId },
          data: {
            jobNo,
            departmentId: departmentId || undefined,
            mode,
            origin: origin?.trim() || null,
            destination: destination?.trim() || null,
            draftStep: Math.max(1, isDraftSave ? 1 : 2),
          },
        })
      } else {
        shipment = await prisma.shipment.create({
          data: {
            orgId: sessionUser.orgId,
            jobNo,
            departmentId: departmentId || sessionUser.departments[0]?.id || null,
            mode,
            origin: origin?.trim() || null,
            destination: destination?.trim() || null,
            ownerId: sessionUser.id,
            status: 'draft',
            draftStep: isDraftSave ? 1 : 2,
          },
        })
      }

      return NextResponse.json({
        success: true,
        message: 'Lưu thông tin bước 1 thành công.',
        shipmentId: shipment.id,
        draftStep: shipment.draftStep,
        shipment,
      })
    }

    // =========================================================================
    // XỬ LÝ BƯỚC 2: THÔNG TIN LÔ & BẢNG HÀNG HÓA/HS CODE
    // =========================================================================
    if (step === 2) {
      if (!shipmentId) {
        return NextResponse.json({ error: 'Thiếu mã định danh lô hàng.' }, { status: 400 })
      }

      const currentShipment = await prisma.shipment.findUnique({
        where: { id: shipmentId },
      })

      if (!currentShipment) {
        return NextResponse.json({ error: 'Lô hàng không tồn tại.' }, { status: 404 })
      }

      let targetCustomerId = rawCustomerId

      // Nếu tạo mới khách hàng inline
      if (newCustomer && (!rawCustomerId || rawCustomerId === 'new')) {
        const { name: custName, taxCode: custTaxCode, shortName: custShortName } = newCustomer

        if (!custName || !custName.trim()) {
          return NextResponse.json({ error: 'Tên doanh nghiệp/khách hàng không được để trống.' }, { status: 400 })
        }

        // Bắt buộc kiểm tra mã số thuế
        const mstCheck = validateVietnameseTaxCode(custTaxCode)
        if (!mstCheck.valid) {
          return NextResponse.json({ error: mstCheck.message }, { status: 400 })
        }

        // Chặn trùng lặp MST
        const existingCust = await prisma.customer.findFirst({
          where: {
            orgId: sessionUser.orgId,
            taxCode: custTaxCode.trim(),
          },
        })

        if (existingCust) {
          targetCustomerId = existingCust.id
        } else {
          const createdCust = await prisma.customer.create({
            data: {
              orgId: sessionUser.orgId,
              name: custName.trim(),
              shortName: (custShortName || custName).trim(),
              taxCode: custTaxCode.trim(),
            },
          })
          targetCustomerId = createdCust.id
        }
      }

      // Nếu không phải lưu nháp đơn thuần, kiểm tra các trường bắt buộc của Bước 2
      if (!isDraftSave) {
        if (!targetCustomerId) {
          return NextResponse.json({ error: 'Vui lòng chọn hoặc tạo mới Doanh nghiệp/Khách hàng.' }, { status: 400 })
        }

        // Tuyến đường
        const routeCheck = validateRoute(currentShipment.origin, currentShipment.destination)
        if (!routeCheck.valid) {
          return NextResponse.json({ error: routeCheck.message }, { status: 400 })
        }

        // Hàng hóa: tối thiểu 1 dòng
        if (!Array.isArray(goods) || goods.length === 0) {
          return NextResponse.json(
            { error: 'Bảng hàng hóa và HS Code bắt buộc phải có tối thiểu 1 dòng.' },
            { status: 400 }
          )
        }
      }

      // Chuẩn hóa và xác thực từng dòng hàng hóa & HS Code
      const normalizedGoods: { description: string; hsCode: string; orderIndex: number }[] = []
      if (Array.isArray(goods)) {
        for (let i = 0; i < goods.length; i++) {
          const item = goods[i]
          if (!isDraftSave || item.description || item.hsCode) {
            if (!item.description || !item.description.trim()) {
              return NextResponse.json({ error: `Dòng hàng thứ ${i + 1}: Vui lòng nhập mô tả hàng hóa.` }, { status: 400 })
            }

            const hsCheck = normalizeAndValidateHsCode(item.hsCode)
            if (!hsCheck.valid) {
              return NextResponse.json(
                { error: `Dòng hàng thứ ${i + 1} ("${item.description}"): ${hsCheck.message}` },
                { status: 400 }
              )
            }

            normalizedGoods.push({
              description: item.description.trim(),
              hsCode: hsCheck.normalized,
              orderIndex: i,
            })
          }
        }
      }

      // Metadata mở rộng (carrier, vessel, voyage, containerNo, incoterms, notes)
      const extraData = {
        carrier: carrier ? carrier.trim() : null,
        vessel: vessel ? vessel.trim() : null,
        voyage: voyage ? voyage.trim() : null,
        containerNo: containerNo ? containerNo.trim() : null,
        incoterms: incoterms ? incoterms.trim() : null,
        notes: notes ? notes.trim() : null,
      }

      // Sinh checklist chứng từ tương ứng
      const checklistTypes = generateShipmentRequirements(
        (currentShipment.mode as any) || 'sea',
        currentShipment.origin || '',
        currentShipment.destination || ''
      )

      // Thực hiện trong một transaction nguyên tử (Atomic) với timeout bảo vệ 15s
      const updatedShipment = await prisma.$transaction(
        async (tx) => {
          // 1. Cập nhật shipment
          const s = await tx.shipment.update({
            where: { id: shipmentId },
            data: {
              customerId: targetCustomerId || null,
              blNo: blNo ? blNo.trim() : null,
              etd: etd ? etd.trim() : null,
              eta: eta ? eta.trim() : null,
              goodsDesc: normalizedGoods.length > 0 ? normalizedGoods[0].description : currentShipment.goodsDesc,
              extra: extraData,
              draftStep: isDraftSave ? 2 : 3, // Nếu đạt chuẩn thì mở bước 3
            },
            include: { customer: true },
          })

          // 2. Thay thế bảng hàng hóa
          await tx.shipmentGoods.deleteMany({
            where: { shipmentId },
          })

          if (normalizedGoods.length > 0) {
            await tx.shipmentGoods.createMany({
              data: normalizedGoods.map((g) => ({
                shipmentId,
                description: g.description,
                hsCode: g.hsCode,
                orderIndex: g.orderIndex,
              })),
            })
          }

          // 3. Khởi tạo/cập nhật checklist requirements (tối ưu hóa: 1 SELECT kiểm tra trùng + 1 BATCH INSERT)
          const existingReqs = await tx.shipmentRequirement.findMany({
            where: { shipmentId },
            select: { docType: true },
          })
          const existingDocTypes = new Set(existingReqs.map((r) => r.docType))
          const newReqs = checklistTypes.filter((dt) => !existingDocTypes.has(dt))

          if (newReqs.length > 0) {
            await tx.shipmentRequirement.createMany({
              data: newReqs.map((docType) => ({
                shipmentId,
                docType,
                isMandatory: true,
                status: 'MISSING',
              })),
            })
          }

          return s
        },
        { timeout: 15000, maxWait: 5000 }
      )

      return NextResponse.json({
        success: true,
        message: 'Lưu thông tin bước 2 thành công. Đủ điều kiện chuyển sang bước 3.',
        shipmentId: updatedShipment.id,
        draftStep: updatedShipment.draftStep,
        shipment: updatedShipment,
      })
    }

    // =========================================================================
    // XỬ LÝ BƯỚC 3: HOÀN TẤT / HOÀN TẤT SAU (LƯU LÔ VÀ KÍCH HOẠT BOOKING)
    // =========================================================================
    if (step === 3 || finalizeLater || complete) {
      if (!shipmentId) {
        return NextResponse.json({ error: 'Thiếu mã định danh lô hàng.' }, { status: 400 })
      }

      const shipment = await prisma.shipment.findUnique({
        where: { id: shipmentId },
        include: {
          customer: true,
          goods: true,
          requirements: true,
        },
      })

      if (!shipment) {
        return NextResponse.json({ error: 'Lô hàng không tồn tại.' }, { status: 404 })
      }

      // KIỂM TRA BẮT BUỘC: Lô phải đủ thông tin bắt buộc mới cho phép hoàn tất hoặc mở Bước 3
      if (!shipment.customerId || !shipment.customer) {
        return NextResponse.json({ error: 'Lô hàng chưa có Doanh nghiệp/Khách hàng hợp lệ. Vui lòng quay lại Bước 2.' }, { status: 400 })
      }

      const mstCheck = validateVietnameseTaxCode(shipment.customer.taxCode)
      if (!mstCheck.valid) {
        return NextResponse.json({ error: `Mã số thuế doanh nghiệp không hợp lệ: ${mstCheck.message}` }, { status: 400 })
      }

      const routeCheck = validateRoute(shipment.origin, shipment.destination)
      if (!routeCheck.valid) {
        return NextResponse.json({ error: routeCheck.message }, { status: 400 })
      }

      if (!shipment.goods || shipment.goods.length === 0) {
        return NextResponse.json({ error: 'Lô hàng chưa có dữ liệu hàng hóa. Vui lòng quay lại Bước 2.' }, { status: 400 })
      }

      // Chuyển trạng thái từ draft sang booking
      const newStatus = 'booking'
      const oldStatus = shipment.status

      const finalShipment = await prisma.$transaction(
        async (tx) => {
          const updated = await tx.shipment.update({
            where: { id: shipmentId },
            data: {
              status: newStatus,
              draftStep: 3,
            },
            include: {
              customer: true,
              goods: { orderBy: { orderIndex: 'asc' } },
              requirements: true,
              documents: true,
            },
          })

          // Ghi lại lịch sử thay đổi trạng thái nếu trước đó là draft
          if (oldStatus !== newStatus) {
            await tx.shipmentStatusHistory.create({
              data: {
                shipmentId,
                oldStatus,
                newStatus,
                changedBy: sessionUser.id,
                note: finalizeLater ? 'Lô hàng hoàn tất sau, lưu trữ tài liệu đang thiếu' : 'Hoàn tất khởi tạo lô hàng từ Wizard',
              },
            })
          }

          return updated
        },
        { timeout: 15000, maxWait: 5000 }
      )

      // Ghi Audit Log & Sync Event ngoài transaction để tránh giữ khóa DB
      try {
        await prisma.auditLog.create({
          data: {
            orgId: sessionUser.orgId,
            userId: sessionUser.id,
            action: 'create',
            resourceType: 'shipment',
            resourceId: shipmentId,
            status: 'SUCCESS',
            diffJson: JSON.stringify({
              jobNo: finalShipment.jobNo,
              mode: finalShipment.mode,
              origin: finalShipment.origin,
              destination: finalShipment.destination,
              goodsCount: finalShipment.goods.length,
              status: newStatus,
            }),
          },
        })

        await prisma.syncEvent.create({
          data: {
            orgId: sessionUser.orgId,
            eventType: 'SHIPMENT_UPDATED',
            entityType: 'shipment',
            entityId: shipmentId,
            payload: JSON.stringify({
              action: 'created_from_wizard',
              jobNo: finalShipment.jobNo,
              departmentId: finalShipment.departmentId,
              status: newStatus,
            }),
          },
        })
      } catch (logErr) {
        console.warn('Lỗi ghi audit/sync event sau khi lưu lô hàng:', logErr)
      }

      return NextResponse.json({
        success: true,
        message: finalizeLater ? 'Đã lưu lô hàng. Bạn có thể bổ sung chứng từ còn thiếu sau.' : 'Hoàn tất khởi tạo lô hàng thành công.',
        shipment: finalShipment,
      })
    }

    return NextResponse.json({ error: 'Bước xử lý không hợp lệ.' }, { status: 400 })
  } catch (error: any) {
    console.error('Lỗi Wizard API:', error)
    return NextResponse.json({ error: error.message || 'Lỗi xử lý khởi tạo lô hàng.' }, { status: 500 })
  }
}
