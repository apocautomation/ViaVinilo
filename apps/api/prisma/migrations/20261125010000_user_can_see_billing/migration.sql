-- Permiso por usuario para ver los totales en pesos de Inicio (D-089). El dueño los ve siempre.
ALTER TABLE "User" ADD COLUMN "canSeeBilling" BOOLEAN NOT NULL DEFAULT false;
