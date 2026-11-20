-- D-054: el alta pendiente es solo una formalidad. Los pedidos que quedaron frenados en
-- "Alta pendiente" pasan a "Archivo recibido" y entran al tablero de su sector.
INSERT INTO "JobEvent" ("id", "jobId", "fromStatus", "toStatus", "note", "createdAt")
SELECT gen_random_uuid()::text, "id", 'PENDING_SIGNUP', 'RECEIVED',
       'El alta pendiente ya no frena el pedido (D-054)', CURRENT_TIMESTAMP
FROM "JobOrder"
WHERE "status" = 'PENDING_SIGNUP' AND "deletedAt" IS NULL;

UPDATE "JobOrder"
SET "status" = 'RECEIVED', "updatedAt" = CURRENT_TIMESTAMP
WHERE "status" = 'PENDING_SIGNUP' AND "deletedAt" IS NULL;
