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

Para entrar a la API hace falta un usuario: definí `JWT_SECRET`, `SEED_OWNER_EMAIL` y `SEED_OWNER_PASSWORD` en el `.env` antes del seed.

## Backoffice y tablero de producción

`apps/web` en http://localhost:3000: login del personal y tablero por sector (`/tablero/DTF`, `/tablero/SUBLIMACION`…), con un botón grande por tarjeta para el próximo paso y actualización en vivo. Las reglas están en `docs/DESARROLLO.md` (D-030).

Para cargar órdenes de demo pasando por la ingesta real de mails:

```bash
cd apps/worker && DATABASE_URL=... STORAGE_DIR=./storage pnpm exec tsx test/demo-mails.ts
```

Crea dos clientes activos, el usuario `impresor@viavinilo.test` (producción de DTF, sin contraseña: asignarla a mano) y cinco órdenes, una de un remitente sin alta.

## API (por ahora)

| Ruta | Quién | Qué hace |
| --- | --- | --- |
| `POST /auth/login` | público | Email y contraseña → token (12 h). Máximo 5 intentos por minuto. |
| `GET /auth/me` | personal | Usuario y roles. |
| `POST /app/auth/request-code` | público | El cliente pide un código de 6 números a uno de sus emails. La respuesta es siempre la misma (D-038). |
| `POST /app/auth/verify` | público | Email y código → token del cliente (30 días). |
| `GET /app/me` | cliente | Datos del cliente para la app. Los tokens de cliente no sirven en las rutas del personal (D-038). |
| `GET /customers?search=&status=&page=` | personal | Busca por nombre (sin tildes), número de cliente, DNI, email o teléfono. |
| `POST /customers`, `PATCH /customers/:id` | atención, dueño | Alta y edición con la ficha completa: identidad, contactos, datos fiscales, cuenta corriente y avisos (D-038). |
| `POST /customers/:id/approve`, `/block`, `/unblock` | atención, dueño | Validar altas pendientes y bloquear. |
| `POST`/`DELETE /customers/:id/emails`, `/phones` | atención, dueño | Contactos. |
| `DELETE /customers/:id` | dueño | Baja lógica. |
| `GET /sectors`, `GET /file-error-reasons` | personal | Sectores visibles y motivos de error. |
| `GET /jobs/board?sector=&q=&machineId=&groupByMaterial=` | personal (producción, solo su sector) | Tablero kanban. |
| `GET /jobs/board/stream?sector=` | ídem | Avisos en vivo (SSE). |
| `GET /jobs/:id` | ídem | Ficha de la orden con archivos e historial. |
| `POST /jobs/:id/transition` | ídem | Cambio de estado con las reglas del sector. |
| `PATCH /jobs/:id/machine` | ídem | Asignar máquina. |

Para probar la API sin Docker: `cd apps/api && pnpm exec tsx test/serve-test-db.ts` levanta un Postgres en memoria con las migraciones e imprime su `DATABASE_URL`.

## Ingesta de mails

El worker lee las casillas de cada sector cada minuto y crea las órdenes. La fuente se elige con `MAIL_SOURCE`:

- `mailhog` (desarrollo): con `docker compose up -d`, mandá un mail por SMTP a `localhost:1025` dirigido a, por ejemplo, `dtf@viavinilo.local` (el dominio sale de `SEED_MAIL_DOMAIN`). El worker lo toma de MailHog y crea la orden.
- `imap` (producción): Hostinger, con `IMAP_<SECTOR>_USER` / `IMAP_<SECTOR>_PASS` por sector. Solo lee, no marca los mails, y arranca desde el momento de la primera conexión.

Cada mail procesado queda en la tabla `MailIngestLog` con su resultado. Detalle de las reglas en `docs/DESARROLLO.md` (D-027).

## Comandos

| Comando | Qué hace |
| --- | --- |
| `pnpm test` | Tests de todo el monorepo (incluye la migración sobre un Postgres en memoria). |
| `pnpm lint` | ESLint. |
| `pnpm typecheck` | Chequeo de tipos de todos los paquetes. |
| `pnpm build` | Build de producción. |
| `node packages/ui/scripts/generate-palette.mjs` | Regenera la paleta desde los colores del logo. |

## Producción (VPS)

Se describe en D-036 y D-037 de `docs/DESARROLLO.md`.

- **App de clientes:** `https://viavinilo.tech`
- **ERP:** `https://erp.viavinilo.tech`
- **API:** `/api` de cada dominio

Para actualizar el VPS, desde la raíz del repo y con la clave SSH del proyecto:

```bash
git archive HEAD | ssh deploy@<vps> "cd /srv/viavinilo && tar -xf -"
ssh deploy@<vps> "cd /srv/viavinilo && docker compose -f deploy/docker-compose.prod.yml build api && docker compose -f deploy/docker-compose.prod.yml up -d"
```

- **Secretos:** solo en `deploy/.env` del VPS. La plantilla es `deploy/.env.prod.example`.
- **Caddy:** si cambia `deploy/Caddyfile`, copiarlo a `/etc/caddy/Caddyfile` y hacer `sudo systemctl reload caddy`.
