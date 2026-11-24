-- Sectores reales (D-082): un tablero puede tener sub-servicios (tableros hijos).
ALTER TABLE "Sector" ADD COLUMN "parentId" TEXT;
ALTER TABLE "Sector" ADD CONSTRAINT "Sector_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Sector_parentId_idx" ON "Sector"("parentId");

-- DTF pasa a llamarse "DTF Textil" (solo si nadie le cambió el nombre).
UPDATE "Sector" SET "name" = 'DTF Textil', "updatedAt" = now() WHERE "code" = 'DTF' AND "name" = 'DTF';

-- Látex deja de ser un tablero propio: queda dentro de Gran Formato.
UPDATE "Sector" SET "parentId" = (SELECT "id" FROM "Sector" WHERE "code" = 'GRAN_FORMATO'), "updatedAt" = now()
 WHERE "code" = 'LATEX' AND EXISTS (SELECT 1 FROM "Sector" WHERE "code" = 'GRAN_FORMATO');

-- Sub-servicios nuevos de Gran Formato y el tablero TPU. Nacen sin casilla: se les pone desde
-- Configuración cuando se decida leer esas casillas. En una base vacía no hacen nada (los crea el seed).
INSERT INTO "Sector" ("id", "code", "name", "parentId", "active", "createdAt", "updatedAt")
SELECT 'sec_' || lower(v.code), v.code, v.name, gf."id", true, now(), now()
  FROM (VALUES ('ECOSOLVENTE', 'Ecosolvente'), ('UV_ROLLO', 'UV rollo a rollo'), ('UV_RIGIDOS', 'UV rígidos'), ('CORTES', 'Cortes')) AS v(code, name)
  JOIN "Sector" gf ON gf."code" = 'GRAN_FORMATO'
 WHERE NOT EXISTS (SELECT 1 FROM "Sector" s WHERE s."code" = v.code);

INSERT INTO "Sector" ("id", "code", "name", "active", "createdAt", "updatedAt")
SELECT 'sec_tpu', 'TPU', 'TPU', true, now(), now()
  FROM "Sector" dtf
 WHERE dtf."code" = 'DTF' AND NOT EXISTS (SELECT 1 FROM "Sector" s WHERE s."code" = 'TPU');

-- Los nuevos heredan los pasos y las máquinas del tablero del que salen (Gran Formato o DTF).
INSERT INTO "SectorStage" ("id", "sectorId", "status", "position")
SELECT n."id" || '_' || st."position", n."id", st."status", st."position"
  FROM "Sector" n
  JOIN "Sector" src ON src."code" = CASE WHEN n."code" = 'TPU' THEN 'DTF' ELSE 'GRAN_FORMATO' END
  JOIN "SectorStage" st ON st."sectorId" = src."id"
 WHERE n."id" IN ('sec_ecosolvente', 'sec_uv_rollo', 'sec_uv_rigidos', 'sec_cortes', 'sec_tpu')
   AND NOT EXISTS (SELECT 1 FROM "SectorStage" x WHERE x."sectorId" = n."id");

INSERT INTO "MachineSector" ("machineId", "sectorId")
SELECT ms."machineId", n."id"
  FROM "Sector" n
  JOIN "Sector" src ON src."code" = CASE WHEN n."code" = 'TPU' THEN 'DTF' ELSE 'GRAN_FORMATO' END
  JOIN "MachineSector" ms ON ms."sectorId" = src."id"
 WHERE n."id" IN ('sec_ecosolvente', 'sec_uv_rollo', 'sec_uv_rigidos', 'sec_cortes', 'sec_tpu')
ON CONFLICT DO NOTHING;
