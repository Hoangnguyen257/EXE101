import { prisma } from '../lib/prisma'
import { generateShipmentRequirements } from '../lib/validations/shipment-wizard'

async function fixIncompleteShipments() {
  console.log('================================================================================')
  console.log('🛠️ BẮT ĐẦU QUÉT VÀ KHẮC PHỤC DỮ LIỆU CÁC LÔ HÀNG TẠO DỞ DO TIMEOUT')
  console.log('================================================================================')

  const shipments = await prisma.shipment.findMany({
    include: {
      requirements: true,
      goods: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`🔍 Tìm thấy tổng cộng ${shipments.length} lô hàng trong hệ thống.`)

  let fixedChecklistCount = 0
  let fixedGoodsCount = 0

  for (const s of shipments) {
    let modified = false

    // 1. Kiểm tra thiếu checklist requirements
    const requiredTypes = generateShipmentRequirements(
      (s.mode as any) || 'sea',
      s.origin || 'Ho Chi Minh, VN',
      s.destination || 'Singapore, SG'
    )

    const existingTypes = new Set(s.requirements.map((r) => r.docType))
    const missingTypes = requiredTypes.filter((t) => !existingTypes.has(t))

    if (missingTypes.length > 0) {
      console.log(`👉 Lô ${s.jobNo} (ID: ${s.id}): Thiếu ${missingTypes.length} checklist items. Đang bổ sung...`)
      await prisma.shipmentRequirement.createMany({
        data: missingTypes.map((docType) => ({
          shipmentId: s.id,
          docType,
          isMandatory: true,
          status: 'MISSING',
        })),
      })
      fixedChecklistCount++
      modified = true
    }

    // 2. Kiểm tra hàng hóa nếu lô không còn là draft bước 1 nhưng chưa có goods
    if (s.status !== 'draft' && s.goods.length === 0) {
      console.log(`👉 Lô ${s.jobNo} (ID: ${s.id}, status: ${s.status}): Thiếu danh mục hàng hóa. Đang khởi tạo...`)
      await prisma.shipmentGoods.create({
        data: {
          shipmentId: s.id,
          description: s.goodsDesc || 'Hàng hóa thông thường theo hợp đồng',
          hsCode: '',
          orderIndex: 0,
        },
      })
      fixedGoodsCount++
      modified = true
    }

    if (modified) {
      console.log(`   ✅ Đã sửa xong lô hàng ${s.jobNo}`)
    }
  }

  console.log('\n================================================================================')
  console.log('📊 BÁO CÁO KẾT QUẢ KHẮC PHỤC DỮ LIỆU:')
  console.log(`- Số lô hàng đã được bổ sung Checklist chứng từ: ${fixedChecklistCount}`)
  console.log(`- Số lô hàng đã được bổ sung danh mục Hàng hóa:   ${fixedGoodsCount}`)
  console.log('================================================================================\n')
}

fixIncompleteShipments()
  .catch((err) => {
    console.error('Lỗi khi khắc phục dữ liệu:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

