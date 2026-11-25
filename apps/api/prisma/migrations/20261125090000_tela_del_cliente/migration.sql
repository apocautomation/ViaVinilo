-- D-113 (Verónica, 25/11): la tela que trae el cliente se imprime aparte de las telas de Via Vinilo.
-- Opción propia en Calandrado para que en "Agrupar por opción" quede en su bloque. En una base nueva
-- todavía no hay tableros y no inserta nada: el seed la carga.
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "active", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'TCLI', 'Tela del cliente', true, 40, now(), now() FROM "Sector" s WHERE s."code" = 'CALANDRADO'
ON CONFLICT ("code") DO NOTHING;
