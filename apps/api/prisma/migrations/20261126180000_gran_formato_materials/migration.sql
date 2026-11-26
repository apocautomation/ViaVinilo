-- D-117: el código y el SKU de Tango de una opción son únicos dentro de su tablero, no en todo el sistema:
-- el mismo vinilo está en Látex, Ecosolvente y UV rollo a rollo.
DROP INDEX "SectorVariant_code_key";
DROP INDEX "SectorVariant_tangoSku_key";
CREATE UNIQUE INDEX "SectorVariant_sectorId_code_key" ON "SectorVariant"("sectorId", "code");
CREATE UNIQUE INDEX "SectorVariant_sectorId_tangoSku_key" ON "SectorVariant"("sectorId", "tangoSku");

-- Lonas y vinilos de Gran Formato (Excel "LONAS Y VINILOS" de Ricardo, 26/11), sin precios ni SKU todavía.
-- Como el seed, si el código ya existe en ese tablero no se toca (lo edita el dueño). En una base nueva todavía
-- no hay tableros y no inserta nada: el seed carga el mismo catálogo.
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'JBB', 'Vinilo Jaspe base blanca', NULL, '106, 127, 137, 152', NULL, true, 1, now(), now() FROM "Sector" s WHERE s."code" = 'LATEX'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'JBG', 'Vinilo Jaspe base gris', NULL, '106, 127, 137, 152', NULL, true, 2, now(), now() FROM "Sector" s WHERE s."code" = 'LATEX'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'JTR', 'Vinilo Jaspe transparente', NULL, '106, 127, 137, 152', NULL, true, 3, now(), now() FROM "Sector" s WHERE s."code" = 'LATEX'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'JMBB', 'Vinilo Jaspe mate base blanca', NULL, '106, 127, 137, 152', NULL, true, 4, now(), now() FROM "Sector" s WHERE s."code" = 'LATEX'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'JMBG', 'Vinilo Jaspe mate base gris', NULL, '106, 127, 137, 152', NULL, true, 5, now(), now() FROM "Sector" s WHERE s."code" = 'LATEX'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'DBB', 'Vinilo DPI base blanca', NULL, '106, 127, 137, 152', NULL, true, 6, now(), now() FROM "Sector" s WHERE s."code" = 'LATEX'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'DBG', 'Vinilo DPI base gris', NULL, '106, 127, 137, 152', NULL, true, 7, now(), now() FROM "Sector" s WHERE s."code" = 'LATEX'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'DTR', 'Vinilo DPI transparente', NULL, '106, 127, 137, 152', NULL, true, 8, now(), now() FROM "Sector" s WHERE s."code" = 'LATEX'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'DMBG', 'Vinilo DPI mate base gris', NULL, '106, 127, 137, 152', NULL, true, 9, now(), now() FROM "Sector" s WHERE s."code" = 'LATEX'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'LG17BB', 'Vinilo LG 1700 base blanca', NULL, '106, 127, 137, 152', NULL, true, 10, now(), now() FROM "Sector" s WHERE s."code" = 'LATEX'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'LG17BG', 'Vinilo LG 1700 base gris', NULL, '106, 127, 137, 152', NULL, true, 11, now(), now() FROM "Sector" s WHERE s."code" = 'LATEX'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'LG17TR', 'Vinilo LG 1700 transparente', NULL, '106, 127, 137, 152', NULL, true, 12, now(), now() FROM "Sector" s WHERE s."code" = 'LATEX'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'LG17MBB', 'Vinilo LG 1700 mate base blanca', NULL, '106, 127, 137, 152', NULL, true, 13, now(), now() FROM "Sector" s WHERE s."code" = 'LATEX'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'LG2700', 'Vinilo LG 2700 base blanca', NULL, '106, 127, 137, 152', NULL, true, 14, now(), now() FROM "Sector" s WHERE s."code" = 'LATEX'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'LG2710', 'Vinilo LG 2710 base gris', NULL, '106, 127, 137, 152', NULL, true, 15, now(), now() FROM "Sector" s WHERE s."code" = 'LATEX'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'LG2812', 'Vinilo LG 2812 transparente', NULL, '106, 127, 137, 152', NULL, true, 16, now(), now() FROM "Sector" s WHERE s."code" = 'LATEX'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'LG2710M', 'Vinilo LG 2710M mate base gris', NULL, '106, 127, 137, 152', NULL, true, 17, now(), now() FROM "Sector" s WHERE s."code" = 'LATEX'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'INF6000', 'Vinilo Inflex 6000 base blanca', NULL, '106, 127, 137, 152', NULL, true, 18, now(), now() FROM "Sector" s WHERE s."code" = 'LATEX'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'INF6200', 'Vinilo Inflex 6200 base gris', NULL, '106, 127, 137, 152', NULL, true, 19, now(), now() FROM "Sector" s WHERE s."code" = 'LATEX'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'INF3200', 'Vinilo Inflex i3200 bubble free', NULL, '106, 127, 137, 152', NULL, true, 20, now(), now() FROM "Sector" s WHERE s."code" = 'LATEX'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'MICRO', 'Vinilo microperforado', NULL, '106, 127, 137, 152', NULL, true, 21, now(), now() FROM "Sector" s WHERE s."code" = 'LATEX'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'L13B', 'Lona 13 oz brillo', NULL, '91, 100, 110, 125, 137, 152, 160', NULL, true, 22, now(), now() FROM "Sector" s WHERE s."code" = 'LATEX'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'L13M', 'Lona 13 oz mate', NULL, '91, 100, 110, 125, 137, 152, 160', NULL, true, 23, now(), now() FROM "Sector" s WHERE s."code" = 'LATEX'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'LBACK', 'Lona backlight', NULL, '91, 100, 110, 125, 137, 152, 160', NULL, true, 24, now(), now() FROM "Sector" s WHERE s."code" = 'LATEX'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'JBB', 'Vinilo Jaspe base blanca', NULL, '106, 127, 137, 152', NULL, true, 1, now(), now() FROM "Sector" s WHERE s."code" = 'ECOSOLVENTE'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'JBG', 'Vinilo Jaspe base gris', NULL, '106, 127, 137, 152', NULL, true, 2, now(), now() FROM "Sector" s WHERE s."code" = 'ECOSOLVENTE'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'JTR', 'Vinilo Jaspe transparente', NULL, '106, 127, 137, 152', NULL, true, 3, now(), now() FROM "Sector" s WHERE s."code" = 'ECOSOLVENTE'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'JMBB', 'Vinilo Jaspe mate base blanca', NULL, '106, 127, 137, 152', NULL, true, 4, now(), now() FROM "Sector" s WHERE s."code" = 'ECOSOLVENTE'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'JMBG', 'Vinilo Jaspe mate base gris', NULL, '106, 127, 137, 152', NULL, true, 5, now(), now() FROM "Sector" s WHERE s."code" = 'ECOSOLVENTE'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'DBB', 'Vinilo DPI base blanca', NULL, '106, 127, 137, 152', NULL, true, 6, now(), now() FROM "Sector" s WHERE s."code" = 'ECOSOLVENTE'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'DBG', 'Vinilo DPI base gris', NULL, '106, 127, 137, 152', NULL, true, 7, now(), now() FROM "Sector" s WHERE s."code" = 'ECOSOLVENTE'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'DTR', 'Vinilo DPI transparente', NULL, '106, 127, 137, 152', NULL, true, 8, now(), now() FROM "Sector" s WHERE s."code" = 'ECOSOLVENTE'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'DMBG', 'Vinilo DPI mate base gris', NULL, '106, 127, 137, 152', NULL, true, 9, now(), now() FROM "Sector" s WHERE s."code" = 'ECOSOLVENTE'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'LG17BB', 'Vinilo LG 1700 base blanca', NULL, '106, 127, 137, 152', NULL, true, 10, now(), now() FROM "Sector" s WHERE s."code" = 'ECOSOLVENTE'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'LG17BG', 'Vinilo LG 1700 base gris', NULL, '106, 127, 137, 152', NULL, true, 11, now(), now() FROM "Sector" s WHERE s."code" = 'ECOSOLVENTE'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'LG17TR', 'Vinilo LG 1700 transparente', NULL, '106, 127, 137, 152', NULL, true, 12, now(), now() FROM "Sector" s WHERE s."code" = 'ECOSOLVENTE'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'LG17MBB', 'Vinilo LG 1700 mate base blanca', NULL, '106, 127, 137, 152', NULL, true, 13, now(), now() FROM "Sector" s WHERE s."code" = 'ECOSOLVENTE'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'LG2700', 'Vinilo LG 2700 base blanca', NULL, '106, 127, 137, 152', NULL, true, 14, now(), now() FROM "Sector" s WHERE s."code" = 'ECOSOLVENTE'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'LG2710', 'Vinilo LG 2710 base gris', NULL, '106, 127, 137, 152', NULL, true, 15, now(), now() FROM "Sector" s WHERE s."code" = 'ECOSOLVENTE'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'LG2812', 'Vinilo LG 2812 transparente', NULL, '106, 127, 137, 152', NULL, true, 16, now(), now() FROM "Sector" s WHERE s."code" = 'ECOSOLVENTE'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'LG2710M', 'Vinilo LG 2710M mate base gris', NULL, '106, 127, 137, 152', NULL, true, 17, now(), now() FROM "Sector" s WHERE s."code" = 'ECOSOLVENTE'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'INF6000', 'Vinilo Inflex 6000 base blanca', NULL, '106, 127, 137, 152', NULL, true, 18, now(), now() FROM "Sector" s WHERE s."code" = 'ECOSOLVENTE'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'INF6200', 'Vinilo Inflex 6200 base gris', NULL, '106, 127, 137, 152', NULL, true, 19, now(), now() FROM "Sector" s WHERE s."code" = 'ECOSOLVENTE'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'INF3200', 'Vinilo Inflex i3200 bubble free', NULL, '106, 127, 137, 152', NULL, true, 20, now(), now() FROM "Sector" s WHERE s."code" = 'ECOSOLVENTE'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'MICRO', 'Vinilo microperforado', NULL, '106, 127, 137, 152', NULL, true, 21, now(), now() FROM "Sector" s WHERE s."code" = 'ECOSOLVENTE'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'L13B', 'Lona 13 oz brillo', NULL, '91, 100, 110, 125, 137, 152, 160, 182, 200, 220, 250, 320', NULL, true, 22, now(), now() FROM "Sector" s WHERE s."code" = 'ECOSOLVENTE'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'L13M', 'Lona 13 oz mate', NULL, '91, 100, 110, 125, 137, 152, 160, 182, 200, 220, 250, 320', NULL, true, 23, now(), now() FROM "Sector" s WHERE s."code" = 'ECOSOLVENTE'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'LBACK', 'Lona backlight', NULL, '91, 100, 110, 125, 137, 152, 160, 182, 200, 220, 250, 320', NULL, true, 24, now(), now() FROM "Sector" s WHERE s."code" = 'ECOSOLVENTE'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'L8B', 'Lona 8 oz brillo', NULL, '250, 320', NULL, true, 25, now(), now() FROM "Sector" s WHERE s."code" = 'ECOSOLVENTE'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'LMESH', 'Lona mesh', NULL, '220, 250, 320', NULL, true, 26, now(), now() FROM "Sector" s WHERE s."code" = 'ECOSOLVENTE'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'JBB', 'Vinilo Jaspe base blanca', NULL, '106, 127, 137, 152', NULL, true, 1, now(), now() FROM "Sector" s WHERE s."code" = 'UV_ROLLO'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'JBG', 'Vinilo Jaspe base gris', NULL, '106, 127, 137, 152', NULL, true, 2, now(), now() FROM "Sector" s WHERE s."code" = 'UV_ROLLO'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'JTR', 'Vinilo Jaspe transparente', NULL, '106, 127, 137, 152', NULL, true, 3, now(), now() FROM "Sector" s WHERE s."code" = 'UV_ROLLO'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'JMBB', 'Vinilo Jaspe mate base blanca', NULL, '106, 127, 137, 152', NULL, true, 4, now(), now() FROM "Sector" s WHERE s."code" = 'UV_ROLLO'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'JMBG', 'Vinilo Jaspe mate base gris', NULL, '106, 127, 137, 152', NULL, true, 5, now(), now() FROM "Sector" s WHERE s."code" = 'UV_ROLLO'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'DBB', 'Vinilo DPI base blanca', NULL, '106, 127, 137, 152', NULL, true, 6, now(), now() FROM "Sector" s WHERE s."code" = 'UV_ROLLO'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'DBG', 'Vinilo DPI base gris', NULL, '106, 127, 137, 152', NULL, true, 7, now(), now() FROM "Sector" s WHERE s."code" = 'UV_ROLLO'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'DTR', 'Vinilo DPI transparente', NULL, '106, 127, 137, 152', NULL, true, 8, now(), now() FROM "Sector" s WHERE s."code" = 'UV_ROLLO'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'DMBG', 'Vinilo DPI mate base gris', NULL, '106, 127, 137, 152', NULL, true, 9, now(), now() FROM "Sector" s WHERE s."code" = 'UV_ROLLO'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'LG17BB', 'Vinilo LG 1700 base blanca', NULL, '106, 127, 137, 152', NULL, true, 10, now(), now() FROM "Sector" s WHERE s."code" = 'UV_ROLLO'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'LG17BG', 'Vinilo LG 1700 base gris', NULL, '106, 127, 137, 152', NULL, true, 11, now(), now() FROM "Sector" s WHERE s."code" = 'UV_ROLLO'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'LG17TR', 'Vinilo LG 1700 transparente', NULL, '106, 127, 137, 152', NULL, true, 12, now(), now() FROM "Sector" s WHERE s."code" = 'UV_ROLLO'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'LG17MBB', 'Vinilo LG 1700 mate base blanca', NULL, '106, 127, 137, 152', NULL, true, 13, now(), now() FROM "Sector" s WHERE s."code" = 'UV_ROLLO'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'LG2700', 'Vinilo LG 2700 base blanca', NULL, '106, 127, 137, 152', NULL, true, 14, now(), now() FROM "Sector" s WHERE s."code" = 'UV_ROLLO'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'LG2710', 'Vinilo LG 2710 base gris', NULL, '106, 127, 137, 152', NULL, true, 15, now(), now() FROM "Sector" s WHERE s."code" = 'UV_ROLLO'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'LG2812', 'Vinilo LG 2812 transparente', NULL, '106, 127, 137, 152', NULL, true, 16, now(), now() FROM "Sector" s WHERE s."code" = 'UV_ROLLO'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'LG2710M', 'Vinilo LG 2710M mate base gris', NULL, '106, 127, 137, 152', NULL, true, 17, now(), now() FROM "Sector" s WHERE s."code" = 'UV_ROLLO'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'INF6000', 'Vinilo Inflex 6000 base blanca', NULL, '106, 127, 137, 152', NULL, true, 18, now(), now() FROM "Sector" s WHERE s."code" = 'UV_ROLLO'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'INF6200', 'Vinilo Inflex 6200 base gris', NULL, '106, 127, 137, 152', NULL, true, 19, now(), now() FROM "Sector" s WHERE s."code" = 'UV_ROLLO'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'INF3200', 'Vinilo Inflex i3200 bubble free', NULL, '106, 127, 137, 152', NULL, true, 20, now(), now() FROM "Sector" s WHERE s."code" = 'UV_ROLLO'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'MICRO', 'Vinilo microperforado', NULL, '106, 127, 137, 152', NULL, true, 21, now(), now() FROM "Sector" s WHERE s."code" = 'UV_ROLLO'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'L13B', 'Lona 13 oz brillo', NULL, '91, 100, 110, 125, 137, 152, 160', NULL, true, 22, now(), now() FROM "Sector" s WHERE s."code" = 'UV_ROLLO'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'L13M', 'Lona 13 oz mate', NULL, '91, 100, 110, 125, 137, 152, 160', NULL, true, 23, now(), now() FROM "Sector" s WHERE s."code" = 'UV_ROLLO'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'LBACK', 'Lona backlight', NULL, '91, 100, 110, 125, 137, 152, 160', NULL, true, 24, now(), now() FROM "Sector" s WHERE s."code" = 'UV_ROLLO'
ON CONFLICT ("sectorId", "code") DO NOTHING;
