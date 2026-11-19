# Imagen única de producción (D-037): compila todo el monorepo una vez y cada servicio
# del compose la arranca con su propio comando (api, worker, web, pwa).
FROM node:24-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1 TZ=America/Argentina/Salta
RUN corepack enable

WORKDIR /app

# Dependencias primero, para aprovechar la caché de Docker.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/web/package.json apps/web/
COPY apps/pwa/package.json apps/pwa/
COPY packages/contracts/package.json packages/contracts/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile

COPY . .

# URL pública de la API que usa el ERP desde el navegador. Next la fija al compilar.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
# WhatsApp de la empresa para "¿Todavía no sos cliente?" en la app (D-038).
ARG NEXT_PUBLIC_SUPPORT_WHATSAPP_URL=""
ENV NEXT_PUBLIC_SUPPORT_WHATSAPP_URL=$NEXT_PUBLIC_SUPPORT_WHATSAPP_URL
RUN pnpm -r build
