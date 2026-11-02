-- AlterTable Shipment for wizard draft support
ALTER TABLE "Shipment" ADD COLUMN "draftStep" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Shipment" ADD COLUMN "extra" TEXT;

-- CreateTable ShipmentGoods
CREATE TABLE IF NOT EXISTS "ShipmentGoods" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shipmentId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "hsCode" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShipmentGoods_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ShipmentGoods_shipmentId_idx" ON "ShipmentGoods"("shipmentId");

