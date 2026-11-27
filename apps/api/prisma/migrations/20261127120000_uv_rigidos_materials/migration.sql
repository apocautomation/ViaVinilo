-- D-118: placas de UV rígidos (Excel "UV RIGIDO" de Ricardo, 27/11), sin precios ni SKU todavía.
-- Como el seed, si el código ya existe en ese tablero no se toca (lo edita el dueño). En una base nueva todavía
-- no hay tableros y no inserta nada: el seed carga el mismo catálogo.
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'CORR22', 'Corrugado 2,2 mm', NULL, '66x50, 100x100, 100x200', NULL, true, 1, now(), now() FROM "Sector" s WHERE s."code" = 'UV_RIGIDOS'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'CORR24', 'Corrugado 2,4 mm', NULL, '61x61, 61x122, 122x122, 122x244', NULL, true, 2, now(), now() FROM "Sector" s WHERE s."code" = 'UV_RIGIDOS'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'CORR25', 'Corrugado 2,5 mm', NULL, '66x50, 100x100, 100x200', NULL, true, 3, now(), now() FROM "Sector" s WHERE s."code" = 'UV_RIGIDOS'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'CORR3', 'Corrugado 3 mm', NULL, '61x61, 61x122, 122x122, 122x244', NULL, true, 4, now(), now() FROM "Sector" s WHERE s."code" = 'UV_RIGIDOS'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'CORR4', 'Corrugado 4 mm', NULL, '61x61, 61x122, 122x122, 122x244', NULL, true, 5, now(), now() FROM "Sector" s WHERE s."code" = 'UV_RIGIDOS'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'CORR6', 'Corrugado 6 mm', NULL, '61x61, 61x122, 122x122, 122x244', NULL, true, 6, now(), now() FROM "Sector" s WHERE s."code" = 'UV_RIGIDOS'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'CORR7', 'Corrugado 7 mm', NULL, '61x61, 61x122, 122x122, 122x244', NULL, true, 7, now(), now() FROM "Sector" s WHERE s."code" = 'UV_RIGIDOS'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'CORR8', 'Corrugado 8 mm', NULL, '61x61, 61x122, 122x122, 122x244', NULL, true, 8, now(), now() FROM "Sector" s WHERE s."code" = 'UV_RIGIDOS'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'AI03', 'Alto impacto 0,3 mm', NULL, '50x100, 100x100, 100x200', NULL, true, 9, now(), now() FROM "Sector" s WHERE s."code" = 'UV_RIGIDOS'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'AI05', 'Alto impacto 0,5 mm', NULL, '50x100, 100x100, 100x200', NULL, true, 10, now(), now() FROM "Sector" s WHERE s."code" = 'UV_RIGIDOS'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'AI08', 'Alto impacto 0,8 mm', NULL, '50x100, 100x100, 100x200', NULL, true, 11, now(), now() FROM "Sector" s WHERE s."code" = 'UV_RIGIDOS'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'AI1', 'Alto impacto 1 mm', NULL, '50x100, 100x100, 100x200', NULL, true, 12, now(), now() FROM "Sector" s WHERE s."code" = 'UV_RIGIDOS'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'AI15', 'Alto impacto 1,5 mm', NULL, '50x100, 100x100, 100x200', NULL, true, 13, now(), now() FROM "Sector" s WHERE s."code" = 'UV_RIGIDOS'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'AI2', 'Alto impacto 2 mm', NULL, '50x100, 100x100, 100x200', NULL, true, 14, now(), now() FROM "Sector" s WHERE s."code" = 'UV_RIGIDOS'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'AI3', 'Alto impacto 3 mm', NULL, '50x100, 100x100, 100x200', NULL, true, 15, now(), now() FROM "Sector" s WHERE s."code" = 'UV_RIGIDOS'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'PVC2', 'PVC espumado 2 mm', NULL, '61x61, 61x122, 122x122, 122x244', NULL, true, 16, now(), now() FROM "Sector" s WHERE s."code" = 'UV_RIGIDOS'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'PVC3', 'PVC espumado 3 mm', NULL, '61x61, 61x122, 122x122, 122x244', NULL, true, 17, now(), now() FROM "Sector" s WHERE s."code" = 'UV_RIGIDOS'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'PVC5', 'PVC espumado 5 mm', NULL, '61x61, 61x122, 122x122, 122x244', NULL, true, 18, now(), now() FROM "Sector" s WHERE s."code" = 'UV_RIGIDOS'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'PVC10', 'PVC espumado 10 mm', NULL, '61x61, 61x122, 122x122, 122x244', NULL, true, 19, now(), now() FROM "Sector" s WHERE s."code" = 'UV_RIGIDOS'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'ACT2', 'Acrílico transparente 2 mm', NULL, '61x61, 61x122, 122x122, 122x244', NULL, true, 20, now(), now() FROM "Sector" s WHERE s."code" = 'UV_RIGIDOS'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'ACT3', 'Acrílico transparente 3 mm', NULL, '61x61, 61x122, 122x122, 122x244', NULL, true, 21, now(), now() FROM "Sector" s WHERE s."code" = 'UV_RIGIDOS'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'ACT5', 'Acrílico transparente 5 mm', NULL, '61x61, 61x122, 122x122, 122x244', NULL, true, 22, now(), now() FROM "Sector" s WHERE s."code" = 'UV_RIGIDOS'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'ACB2', 'Acrílico blanco traslúcido 2 mm', NULL, '61x61, 61x122, 122x122, 122x244', NULL, true, 23, now(), now() FROM "Sector" s WHERE s."code" = 'UV_RIGIDOS'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'ACB3', 'Acrílico blanco traslúcido 3 mm', NULL, '61x61, 61x122, 122x122, 122x244', NULL, true, 24, now(), now() FROM "Sector" s WHERE s."code" = 'UV_RIGIDOS'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'ACB5', 'Acrílico blanco traslúcido 5 mm', NULL, '61x61, 61x122, 122x122, 122x244', NULL, true, 25, now(), now() FROM "Sector" s WHERE s."code" = 'UV_RIGIDOS'
ON CONFLICT ("sectorId", "code") DO NOTHING;
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "tangoSku", "width", "usableWidth", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'FOAM5', 'Foam board 5 mm', NULL, '61x61, 61x122, 122x122, 122x244', NULL, true, 26, now(), now() FROM "Sector" s WHERE s."code" = 'UV_RIGIDOS'
ON CONFLICT ("sectorId", "code") DO NOTHING;
