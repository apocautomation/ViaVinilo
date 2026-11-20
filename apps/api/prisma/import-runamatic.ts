/**
 * Importa el CSV de clientes de Runamatic (D-048, D-049). El CSV nunca va al repo.
 *
 *   pnpm exec tsx prisma/import-runamatic.ts <archivo.csv>           → prueba en seco (no escribe)
 *   pnpm exec tsx prisma/import-runamatic.ts <archivo.csv> --apply   → importa
 *
 * - Todos quedan como clientes activos de Via Vinilo, con `importSource = "runamatic"`.
 * - No se duplica nada: si el teléfono, el email, el DNI o el CUIT ya están en otro cliente (o
 *   repetidos en el mismo CSV), ese dato no se carga y queda anotado en las notas internas.
 * - Volver a correrlo es seguro: se saltea el contacto cuyo teléfono ya está cargado (o, si no
 *   tiene teléfono, cuyo email ya está o que ya se importó con el mismo nombre).
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { mapRunamaticRow, parseCsv } from "./runamatic-map";

async function main() {
  const [file, flag] = process.argv.slice(2);
  if (!file) throw new Error("Uso: tsx prisma/import-runamatic.ts <archivo.csv> [--apply]");
  const apply = flag === "--apply";
  const importedOn = new Date().toLocaleDateString("es-AR", { timeZone: "America/Argentina/Salta" });

  const [header, ...rows] = parseCsv(readFileSync(file, "utf8"));
  if (!header?.includes("Nombre completo") || !header.includes("Teléfono")) {
    throw new Error("No parece el CSV de clientes de Runamatic (faltan columnas)");
  }
  const prisma = new PrismaClient();
  // Importados antes sin teléfono: se reconocen por nombre para no duplicarlos al volver a correrlo.
  const importedNoPhone = new Set(
    (
      await prisma.customer.findMany({
        where: { importSource: "runamatic", phones: { none: {} } },
        select: { searchText: true },
      })
    ).map((c) => c.searchText),
  );
  const [phones, emails, dnis, cuits] = await Promise.all([
    prisma.customerPhone.findMany({ select: { phone: true } }).then((r) => new Set(r.map((x) => x.phone))),
    prisma.customerEmail.findMany({ select: { email: true } }).then((r) => new Set(r.map((x) => x.email))),
    prisma.customer.findMany({ where: { dni: { not: null } }, select: { dni: true } }).then((r) => new Set(r.map((x) => x.dni!))),
    prisma.customer.findMany({ where: { cuit: { not: null } }, select: { cuit: true } }).then((r) => new Set(r.map((x) => x.cuit!))),
  ]);

  const stats = { filas: rows.length, importados: 0, yaCargados: 0, conEmail: 0, sinEmail: 0, conDni: 0, datosRepetidos: 0, avisos: 0 };
  for (const row of rows) {
    const c = mapRunamaticRow(header, row, importedOn);
    const already = c.phone
      ? phones.has(c.phone)
      : (c.email !== null && emails.has(c.email)) || importedNoPhone.has(c.searchText);
    if (already) {
      stats.yaCargados++;
      continue;
    }
    if (!c.phone) importedNoPhone.add(c.searchText);
    const dup: string[] = [];
    const email = c.email && !emails.has(c.email) ? c.email : (c.email && dup.push(`email ${c.email}`), null);
    const dni = c.dni && !dnis.has(c.dni) ? c.dni : (c.dni && dup.push(`DNI ${c.dni}`), null);
    const cuit = c.cuit && !cuits.has(c.cuit) ? c.cuit : (c.cuit && dup.push(`CUIT ${c.cuit}`), null);
    if (dup.length) stats.datosRepetidos++;
    if (c.warnings.length) stats.avisos++;
    const notes = dup.length ? `${c.internalNotes} Repetido en otro cliente, no se cargó: ${dup.join(", ")}.` : c.internalNotes;

    if (apply) {
      const created = await prisma.customer.create({
        data: {
          firstName: c.firstName,
          lastName: c.lastName,
          searchText: c.searchText,
          dni,
          cuit,
          taxCondition: c.taxCondition,
          fiscalAddress: c.fiscalAddress,
          internalNotes: notes,
          status: "ACTIVE",
          importSource: "runamatic",
          approvedAt: new Date(),
          emails: email ? { create: [{ email, isPrimary: true }] } : undefined,
          phones: c.phone ? { create: [{ phone: c.phone, isPrimary: true }] } : undefined,
        },
        select: { id: true },
      });
      await prisma.auditLog.create({
        data: { entity: "Customer", entityId: created.id, action: "import", after: { source: "runamatic" } },
      });
    }
    if (c.phone) phones.add(c.phone);
    if (email) emails.add(email);
    if (dni) dnis.add(dni);
    if (cuit) cuits.add(cuit);
    stats.importados++;
    if (email) stats.conEmail++;
    else stats.sinEmail++;
    if (dni) stats.conDni++;
  }
  await prisma.$disconnect();
  console.log(apply ? "IMPORTADO" : "PRUEBA EN SECO (no se escribió nada; agregá --apply para importar)");
  console.log(stats);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
