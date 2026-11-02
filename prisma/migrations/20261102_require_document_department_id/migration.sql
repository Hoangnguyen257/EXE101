-- Backfill departmentId for Document from related Shipment
UPDATE "Document"
SET "departmentId" = (
    SELECT "departmentId" FROM "Shipment" WHERE "Shipment"."id" = "Document"."shipmentId"
)
WHERE "departmentId" IS NULL;

-- Fallback for any orphaned documents
UPDATE "Document"
SET "departmentId" = (
    SELECT "id" FROM "Department" LIMIT 1
)
WHERE "departmentId" IS NULL;
