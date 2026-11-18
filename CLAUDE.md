# CLAUDE.md — Via Vinilo (APOC Automation)

Sistema a medida para Via Vinilo (Salta): producción de impresiones, app de clientes (el centro del sistema), WhatsApp de soporte, ERP con facturación ARCA y tiendas online.

Antes de cualquier tarea leé **`docs/DESARROLLO.md`**: es el registro de decisiones y cambios, resume el alcance vigente (etapas del contrato del 18/11) y lista las inconsistencias abiertas. Solo si necesitás más detalle, seguí con `docs/ACTUALIZACION-2026-11-17.md` y después con `docs/SPEC.md`.

Precedencia: `DESARROLLO.md` > contrato del 18/11 > `ACTUALIZACION-2026-11-17.md` > `SPEC.md`. La propuesta comercial en PDF está obsoleta. Ante una duda de negocio, la fuente de verdad son esos documentos. Si algo no está ahí, o es un punto abierto del §3 de `DESARROLLO.md`, no lo inventes: dejá un `TODO(spec):` con el ID (por ejemplo `TODO(spec): I-02`) y mencionalo en el PR.

Toda definición nueva (reunión, mensaje del cliente, decisión técnica) se registra en `docs/DESARROLLO.md` con fecha, fuente y porqué, en el mismo PR que la implementa. Si encontrás una inconsistencia, agregala al §3 y avisale a Ezequiel.

## Stack (ver decisión D1 en SPEC)

* Monorepo con pnpm workspaces y TypeScript estricto.
* `apps/api`: NestJS + Prisma + PostgreSQL.
* `apps/worker`: BullMQ + Redis (IMAP, notificaciones, jobs programados).
* `apps/web`: Next.js (App Router), backoffice interno.
* `apps/pwa`: Next.js PWA para clientes.
* `packages/contracts`: DTOs y schemas zod compartidos.
* `packages/ui`: componentes compartidos.
* Infra local: `docker compose up -d` (postgres, redis, mailhog).

## Comandos

* `pnpm i`
* `pnpm dev`: todas las apps.
* `pnpm test`
* `pnpm lint`
* `pnpm typecheck`
* `pnpm prisma migrate dev` (dentro de `apps/api`)

## Reglas de trabajo

* Una etapa por vez. Hoy se trabaja en la Etapa 1 (inicio: 23/11/2026). No construir módulos de etapas posteriores salvo lo mínimo que el modelo necesite.
* Hacer PRs chicos, uno por paso del plan de la §10 del SPEC.
* Toda lógica de negocio con regla `R-*` del SPEC lleva un test que la cite en el nombre. Ejemplo: `it("R-JOB-3: bloquea PRINTING sin seña")`.
* Idempotencia en todo lo que venga de afuera: mails (Message-ID), webhooks de WhatsApp (wamid) y pagos.
* Nunca enviar WhatsApp iniciado por el negocio de forma automática (R-NOT-1). Las notificaciones van por push de la app y por email.
* Los pasos de producción son obligatorios: el sistema no permite saltearlos. Menos clics, más automatización.
* Ideas nuevas del cliente van al backlog; no se implementan sin que Ezequiel las priorice.
* Secretos solo por variables de entorno. Mantener `.env.example` actualizado y nunca commitear credenciales.
* UI, mensajes y textos del bot en español rioplatense (vos). El código y los nombres de variables van en inglés.
* Zona horaria `America/Argentina/Salta`. Montos con decimal (Prisma `Decimal`), nunca float.
* Soft delete y log de auditoría para precios, anulaciones, ajustes de stock y cierres de caja.

## Definición de "hecho"

* Tests, lint y typecheck en verde.
* Migración incluida y seed actualizado.
* README o SPEC actualizado si cambió un comportamiento, y la decisión registrada en `docs/DESARROLLO.md`.
* Probado de punta a punta con un caso real: mail → tablero → push en la PWA.
