-- D-064: el código del tablero pasa de enum a texto para poder crear tableros desde el ERP.
-- Se convierte el tipo en el lugar: los datos y el índice único se conservan.
-- (El diff automático proponía borrar la columna y crearla de nuevo; eso perdía los códigos.)
ALTER TABLE "Sector" ALTER COLUMN "code" TYPE TEXT USING "code"::TEXT;

-- DropEnum
DROP TYPE "SectorCode";
