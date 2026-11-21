#!/bin/sh
# Backup diario de la base (D-063). Corre dentro del servicio "backup" de docker-compose.prod.yml.
# - Un archivo por día en /backups (volumen "backups"): db-AAAA-MM-DD.dump, formato de pg_dump.
# - Se verifica que el archivo se pueda leer antes de darlo por bueno.
# - Se guardan los últimos BACKUP_KEEP_DAYS días (14 por defecto).
# Restaurar: pg_restore --clean --if-exists -d viavinilo /backups/db-AAAA-MM-DD.dump
set -u
KEEP="${BACKUP_KEEP_DAYS:-14}"
mkdir -p /backups

while true; do
  today="$(date +%F)"
  file="/backups/db-$today.dump"
  if [ ! -s "$file" ]; then
    if pg_dump -Fc -f "$file.tmp" && pg_restore -l "$file.tmp" >/dev/null; then
      mv "$file.tmp" "$file"
      echo "[backup] $(date '+%F %T') listo: $file ($(du -h "$file" | cut -f1))"
      find /backups -name 'db-*.dump' -mtime +"$KEEP" -delete
    else
      rm -f "$file.tmp"
      echo "[backup] $(date '+%F %T') ERROR: no se pudo hacer el backup; se reintenta en una hora" >&2
    fi
  fi
  sleep 3600
done
