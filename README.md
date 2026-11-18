# Via Vinilo

Sistema a medida para Via Vinilo (Viaprint S.R.L., Salta), desarrollado por APOC Automation: producción de impresiones, app de clientes, soporte, ERP con facturación ARCA y tiendas online.

**Antes de tocar nada leé [`docs/DESARROLLO.md`](docs/DESARROLLO.md)**: alcance vigente, decisiones y puntos abiertos. Las reglas de trabajo están en [`CLAUDE.md`](CLAUDE.md).

## Estructura

| Carpeta | Qué es |
| --- | --- |
| `apps/api` | API NestJS + Prisma + PostgreSQL. Schema, migraciones y seed en `apps/api/prisma`. |
| `apps/worker` | Colas BullMQ + Redis: ingesta de mails, notificaciones y jobs programados. |
| `apps/web` | Backoffice interno (Next.js). Usa el logo con isotipo. |
| `apps/pwa` | App de clientes instalable (Next.js PWA). Usa el logo con la mascota. |
| `packages/contracts` | Estados, sectores y utilidades compartidas (zod). |
| `packages/ui` | Paleta de colores y tokens compartidos. |
| `docs/marca` | Logos originales (PDF) y SVG extraídos. |

## Puesta en marcha

Requisitos: Node ≥ 22.12, pnpm 11 y un PostgreSQL 16 + Redis (con Docker: `docker compose up -d`).

```bash
pnpm i
cp .env.example .env
cd apps/api && pnpm prisma migrate dev && pnpm db:seed && cd ../..
pnpm dev
```

| App | URL |
| --- | --- |
| Backoffice | http://localhost:3000 |
| API (`/health`) | http://localhost:3001/health |
| App de clientes | http://localhost:3002 |
| Mails capturados (MailHog) | http://localhost:8025 |

## Comandos

| Comando | Qué hace |
| --- | --- |
| `pnpm test` | Tests de todo el monorepo (incluye la migración sobre un Postgres en memoria). |
| `pnpm lint` | ESLint. |
| `pnpm typecheck` | Chequeo de tipos de todos los paquetes. |
| `pnpm build` | Build de producción. |
| `node packages/ui/scripts/generate-palette.mjs` | Regenera la paleta desde los colores del logo. |
