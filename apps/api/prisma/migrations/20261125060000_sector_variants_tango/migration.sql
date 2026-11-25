-- D-108: opciones de impresión con código SKU de Tango y anchos (Excel "DETALLE …" de Ricardo, 25/11).
ALTER TABLE "SectorVariant" ADD COLUMN "tangoSku" TEXT;
ALTER TABLE "SectorVariant" ADD COLUMN "width" TEXT;
ALTER TABLE "SectorVariant" ADD COLUMN "usableWidth" TEXT;
CREATE UNIQUE INDEX "SectorVariant_tangoSku_key" ON "SectorVariant"("tangoSku");

-- Las opciones provisorias de DTF Textil (D-095) pasan a las del Excel, con los mismos pedidos.
UPDATE "SectorVariant" SET "code" = 'NOR' WHERE "code" = 'DTF-NOR';
UPDATE "SectorVariant" SET "code" = 'GLI' WHERE "code" = 'DTF-GLI';
UPDATE "SectorVariant" SET "code" = 'DOR' WHERE "code" = 'DTF-DOR';
UPDATE "SectorVariant" SET "code" = 'PLA' WHERE "code" = 'DTF-PLA';
UPDATE "SectorVariant" SET "code" = 'CCH' WHERE "code" = 'DTF-CCH';
UPDATE "SectorVariant" SET "code" = 'PLS' WHERE "code" = 'DTF-PLT';
-- No están en el Excel: se desactivan (los pedidos que las tienen las conservan).
UPDATE "SectorVariant" SET "active" = false, "updatedAt" = now() WHERE "code" IN ('DTF-REF', 'DTF-FLU', 'DTF-ORO');

-- Alta o actualización del catálogo. En una base nueva todavía no hay tableros y no inserta nada: el seed
-- carga el mismo catálogo.
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'NOR', 'Normal', 'IMDT00004', '60', '58', true, 1, now(), now() FROM "Sector" s WHERE s."code" = 'DTF'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'GLI', 'Glitter', 'IMDT00009', '60', '58', true, 2, now(), now() FROM "Sector" s WHERE s."code" = 'DTF'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'DOR', 'Dorado', 'IMDT00011', '60', '58', true, 3, now(), now() FROM "Sector" s WHERE s."code" = 'DTF'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'PLA', 'Plateado', 'IMDT00010', '60', '58', true, 4, now(), now() FROM "Sector" s WHERE s."code" = 'DTF'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'FOTO', 'Fotoluminiscente', 'IMDT00012', '60', '58', true, 5, now(), now() FROM "Sector" s WHERE s."code" = 'DTF'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'CCH', 'Color change', 'IMDT00013', '60', '58', true, 6, now(), now() FROM "Sector" s WHERE s."code" = 'DTF'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'PLS', 'Plata sólida', 'IMDT00028', '60', '58', true, 7, now(), now() FROM "Sector" s WHERE s."code" = 'DTF'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'UVN', 'Normal', 'IMDT00032', '60', '58', true, 1, now(), now() FROM "Sector" s WHERE s."code" = 'DTF_UV'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'ACET', 'Acetato', 'TECA00003', '160', '155', true, 1, now(), now() FROM "Sector" s WHERE s."code" = 'CALANDRADO'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'BAN70', 'Bandera 70 gr', 'TECA00039', '150', '145', true, 2, now(), now() FROM "Sector" s WHERE s."code" = 'CALANDRADO'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'BAN100', 'Bandera 100 gr', 'TECA00040', '160', '155', true, 3, now(), now() FROM "Sector" s WHERE s."code" = 'CALANDRADO'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'CAS', 'Cas Premium', 'TECA00028', '160', '155', true, 4, now(), now() FROM "Sector" s WHERE s."code" = 'CALANDRADO'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'CIRE', 'Cire', 'TECA00019', '150', '145', true, 5, now(), now() FROM "Sector" s WHERE s."code" = 'CALANDRADO'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'CORDE', 'Corderito', 'TECA00044', '160', '155', true, 6, now(), now() FROM "Sector" s WHERE s."code" = 'CALANDRADO'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'CORDU', 'Cordura', 'TECA00016', '135', '130', true, 7, now(), now() FROM "Sector" s WHERE s."code" = 'CALANDRADO'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'COOL', 'Cool Dry Fit', 'TECA00002', '160', '155', true, 8, now(), now() FROM "Sector" s WHERE s."code" = 'CALANDRADO'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'DEPF', 'Deportivo frizado', 'TECA00006', '160', '155', true, 9, now(), now() FROM "Sector" s WHERE s."code" = 'CALANDRADO'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'DEPSF', 'Deportivo sin friza', 'TECA00005', '150', '145', true, 10, now(), now() FROM "Sector" s WHERE s."code" = 'CALANDRADO'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'FIBV', 'Fibra vinílica', 'TECA00041', '120', '115', true, 11, now(), now() FROM "Sector" s WHERE s."code" = 'CALANDRADO'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'FIFA', 'FIFA - AFA', 'TECA00034', '160', '155', true, 12, now(), now() FROM "Sector" s WHERE s."code" = 'CALANDRADO'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'SET', 'Jersey Set Premium', 'TECA00001', '160', '155', true, 13, now(), now() FROM "Sector" s WHERE s."code" = 'CALANDRADO'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'KET', 'Ketten', 'TECA00007', '160', '155', true, 14, now(), now() FROM "Sector" s WHERE s."code" = 'CALANDRADO'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'LYC', 'Lycra', 'TECA00009', '160', '155', true, 15, now(), now() FROM "Sector" s WHERE s."code" = 'CALANDRADO'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'MESH', 'Mesh', 'TECA00035', '150', '145', true, 16, now(), now() FROM "Sector" s WHERE s."code" = 'CALANDRADO'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'MESSI', 'Messi', 'TECA00031', '160', '155', true, 17, now(), now() FROM "Sector" s WHERE s."code" = 'CALANDRADO'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'MELAS', 'Microelastic', 'TECA00037', '150', '145', true, 18, now(), now() FROM "Sector" s WHERE s."code" = 'CALANDRADO'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'MFIB', 'Microfibra', 'TECA00012', '150', '145', true, 19, now(), now() FROM "Sector" s WHERE s."code" = 'CALANDRADO'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'MODAL', 'Modal', 'TECA00014', '160', '155', true, 20, now(), now() FROM "Sector" s WHERE s."code" = 'CALANDRADO'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'NBA', 'NBA', 'TECA00036', '160', '155', true, 21, now(), now() FROM "Sector" s WHERE s."code" = 'CALANDRADO'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'NIKE', 'Nike', 'TECA00045', '160', '155', true, 22, now(), now() FROM "Sector" s WHERE s."code" = 'CALANDRADO'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'PANC', 'Panal calado', 'TECA00042', '160', '155', true, 23, now(), now() FROM "Sector" s WHERE s."code" = 'CALANDRADO'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'PANA', 'Panal de abeja', 'TECA00029', '160', '155', true, 24, now(), now() FROM "Sector" s WHERE s."code" = 'CALANDRADO'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'PIQ', 'Piquet deportivo', 'TECA00023', '160', '155', true, 25, now(), now() FROM "Sector" s WHERE s."code" = 'CALANDRADO'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'PIXEL', 'Pixel doble rebote', 'TECA00038', '160', '155', true, 26, now(), now() FROM "Sector" s WHERE s."code" = 'CALANDRADO'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'POLAR', 'Polar', 'TECA00008', '160', '155', true, 27, now(), now() FROM "Sector" s WHERE s."code" = 'CALANDRADO'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'POLAP', 'Polar antipeeling', 'TECA00043', '160', '155', true, 28, now(), now() FROM "Sector" s WHERE s."code" = 'CALANDRADO'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'RASO', 'Raso', 'TECA00020', '150', '145', true, 29, now(), now() FROM "Sector" s WHERE s."code" = 'CALANDRADO'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'SILV', 'Silver', 'TECA00018', '150', '145', true, 30, now(), now() FROM "Sector" s WHERE s."code" = 'CALANDRADO'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'SETMF', 'Set de microfibra premium', 'TECA00027', '160', '155', true, 31, now(), now() FROM "Sector" s WHERE s."code" = 'CALANDRADO'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'SOFT', 'Soft shell', 'TECA00032', '160', '155', true, 32, now(), now() FROM "Sector" s WHERE s."code" = 'CALANDRADO'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'SPUN', 'Spun', 'TECA00004', '160', '155', true, 33, now(), now() FROM "Sector" s WHERE s."code" = 'CALANDRADO'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'TAF', 'Tafeta', 'TECA00013', '150', '145', true, 34, now(), now() FROM "Sector" s WHERE s."code" = 'CALANDRADO'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'TOA', 'Toalla', 'TECA00015', '150', '145', true, 35, now(), now() FROM "Sector" s WHERE s."code" = 'CALANDRADO'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'TROP', 'Tropical', 'TECA00010', '150', '145', true, 36, now(), now() FROM "Sector" s WHERE s."code" = 'CALANDRADO'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'TUCK', 'Tucker', 'TECA00017', '150', '145', true, 37, now(), now() FROM "Sector" s WHERE s."code" = 'CALANDRADO'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'MPOC', 'Modelo POC set de microfibra', 'TECA00024', '160', '155', true, 38, now(), now() FROM "Sector" s WHERE s."code" = 'CALANDRADO'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'MSET', 'Modelo Jersey Set', 'TECA00025', '160', '155', true, 39, now(), now() FROM "Sector" s WHERE s."code" = 'CALANDRADO'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'P80A160', 'Papel 80 gr (160 cm)', 'IMSU00018', '160', '157', true, 1, now(), now() FROM "Sector" s WHERE s."code" = 'SUBLIMACION'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'P35', 'Papel 35 gr', 'IMSU00021', '160', '157', true, 2, now(), now() FROM "Sector" s WHERE s."code" = 'SUBLIMACION'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'P80A110', 'Papel 80 gr (110 cm)', 'IMSU00005', '110', '108', true, 3, now(), now() FROM "Sector" s WHERE s."code" = 'SUBLIMACION'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'A4', 'A4', 'IMSU00004', '21x29,7', '20x28', true, 4, now(), now() FROM "Sector" s WHERE s."code" = 'SUBLIMACION'
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "tangoSku" = EXCLUDED."tangoSku", "width" = EXCLUDED."width", "usableWidth" = EXCLUDED."usableWidth", "active" = true, "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now();
