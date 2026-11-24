-- Materiales u opciones de impresión por tablero, con un código propio (D-095).
CREATE TABLE "SectorVariant" (
    "id" TEXT NOT NULL,
    "sectorId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SectorVariant_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SectorVariant_code_key" ON "SectorVariant"("code");
CREATE INDEX "SectorVariant_sectorId_idx" ON "SectorVariant"("sectorId");
ALTER TABLE "SectorVariant" ADD CONSTRAINT "SectorVariant_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JobOrder" ADD COLUMN "variantId" TEXT;
CREATE INDEX "JobOrder_variantId_idx" ON "JobOrder"("variantId");
ALTER TABLE "JobOrder" ADD CONSTRAINT "JobOrder_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "SectorVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Opciones de DTF Textil que pasó Ricardo el 24/11. Los demás tableros se cargan con el Excel del cliente.
INSERT INTO "SectorVariant" ("id", "sectorId", "code", "name", "sortOrder", "updatedAt")
SELECT 'var_' || lower(replace(v.code, '-', '_')), s."id", v.code, v.name, v.ord, now()
  FROM (VALUES
    ('DTF-NOR', 'Normal', 1), ('DTF-REF', 'Reflectivo', 2), ('DTF-FLU', 'Fluorescente', 3),
    ('DTF-GLI', 'Glitter', 4), ('DTF-DOR', 'Dorado', 5), ('DTF-PLA', 'Plateado', 6),
    ('DTF-ORO', 'Oro', 7), ('DTF-PLT', 'Plata', 8), ('DTF-CCH', 'Color change', 9)
  ) AS v(code, name, ord)
  JOIN "Sector" s ON s."code" = 'DTF'
 WHERE NOT EXISTS (SELECT 1 FROM "SectorVariant" x WHERE x."code" = v.code);
