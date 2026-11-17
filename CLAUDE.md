# CLAUDE.md — Via Vinilo (APOC Automation)

Sistema a medida para Via Vinilo (Salta): producción de impresiones, app de clientes (el centro del sistema), WhatsApp de soporte, ERP con facturación ARCA y tiendas online.

Antes de cualquier tarea leé `docs/SPEC.md` y después `docs/ACTUALIZACION-2026-11-17.md`. La actualización tiene prioridad sobre SPEC.md cuando se contradicen (Etapa 2 rediseñada, estados por sector, alta de clientes con DNI y número de cliente, mail en Hostinger, pasos obligatorios). Ante una duda de negocio, la fuente de verdad son esos dos documentos. Si algo no está ahí, no lo inventes: dejá un `TODO(spec):` y mencionalo en el PR.

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

* Una etapa por vez. Hoy se trabaja en la Etapa 1. No construir módulos de etapas posteriores salvo lo mínimo que el modelo necesite.
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
* README o SPEC actualizado si cambió un comportamiento.
* Probado de punta a punta con un caso real: mail → tablero → push en la PWA.
