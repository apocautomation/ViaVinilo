-- D-114: invitación por mail para que cada persona del equipo cree su contraseña del ERP.
CREATE TABLE "UserActivation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserActivation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserActivation_tokenHash_key" ON "UserActivation"("tokenHash");
CREATE INDEX "UserActivation_userId_idx" ON "UserActivation"("userId");

ALTER TABLE "UserActivation" ADD CONSTRAINT "UserActivation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
