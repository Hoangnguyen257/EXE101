-- AlterTable Shipment for wizard draft support
ALTER TABLE "Shipment" ALTER COLUMN "blNo" DROP NOT NULL;
ALTER TABLE "Shipment" ALTER COLUMN "customerId" DROP NOT NULL;
ALTER TABLE "Shipment" ALTER COLUMN "origin" DROP NOT NULL;
ALTER TABLE "Shipment" ALTER COLUMN "destination" DROP NOT NULL;
ALTER TABLE "Shipment" ALTER COLUMN "etd" DROP NOT NULL;
ALTER TABLE "Shipment" ALTER COLUMN "eta" DROP NOT NULL;
ALTER TABLE "Shipment" ALTER COLUMN "status" SET DEFAULT 'draft';
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "draftStep" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "extra" JSONB;

-- CreateTable ShipmentGoods
CREATE TABLE IF NOT EXISTS "ShipmentGoods" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shipmentId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "hsCode" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShipmentGoods_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ShipmentGoods_shipmentId_idx" ON "ShipmentGoods"("shipmentId");

