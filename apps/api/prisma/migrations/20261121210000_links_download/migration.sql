-- Descarga de archivos mandados por link (D-072).
ALTER TABLE "JobOrder" ADD COLUMN "linksFetchedAt" TIMESTAMP(3);
ALTER TABLE "JobOrder" ADD COLUMN "linksNote" TEXT;
