-- Backfill departmentId from related Shipment
UPDATE "Document" d
SET "departmentId" = s."departmentId"
FROM "Shipment" s
WHERE d."shipmentId" = s."id" AND d."departmentId" IS NULL;

-- Fallback for any orphaned documents
UPDATE "Document"
SET "departmentId" = (SELECT "id" FROM "Department" LIMIT 1)
WHERE "departmentId" IS NULL;

-- Make departmentId NOT NULL
ALTER TABLE "Document" ALTER COLUMN "departmentId" SET NOT NULL;

