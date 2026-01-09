# Postgres Backup and Restore

This guide uses the project backup script to capture a Postgres dump from the
Docker Compose `postgres` service and explains how to automate backups via cron.

## Backup script

Location:
- `TrackIT_inventory_management/scripts/postgres_backup.sh`

Behavior:
- Reads `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` from `.env`
- Uses `docker compose` with `docker-compose.yml`
- Writes custom-format dumps to `backups/postgres`

Run once:
```bash
./TrackIT_inventory_management/scripts/postgres_backup.sh
```

Optional environment overrides:
```bash
ENV_FILE=/path/to/.env \
COMPOSE_FILE=/path/to/docker-compose.yml \
BACKUP_DIR=/path/to/backups \
./TrackIT_inventory_management/scripts/postgres_backup.sh
```

## Cron-based backups

1) Ensure the script is executable:
```bash
chmod +x ./TrackIT_inventory_management/scripts/postgres_backup.sh
```

2) Create a cron entry (example: daily at 2:15 AM):
```bash
crontab -e
```

Add a line like:
```bash
15 2 * * * ENV_FILE=/data/projects/SaaS/inventory_management/TrackIT_inventory_management/.env BACKUP_DIR=/data/projects/SaaS/inventory_management/TrackIT_inventory_management/backups/postgres /data/projects/SaaS/inventory_management/TrackIT_inventory_management/scripts/postgres_backup.sh >> /data/projects/SaaS/inventory_management/TrackIT_inventory_management/backups/cron.log 2>&1
```

Notes:
- Use absolute paths in cron.
- The cron user must have permission to run `docker compose`.

## Restore from a backup

Restore will overwrite data in the target database. It is safest to stop the
application containers first.

1) Stop the app (optional but recommended):
```bash
docker compose -f /data/projects/SaaS/inventory_management/TrackIT_inventory_management/docker-compose.yml stop backend frontend
```

2) Restore the dump:
```bash
docker compose -f /data/projects/SaaS/inventory_management/TrackIT_inventory_management/docker-compose.yml exec -T \
  -e PGPASSWORD="${POSTGRES_PASSWORD}" \
  postgres \
  pg_restore -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --clean --if-exists \
  < /data/projects/SaaS/inventory_management/TrackIT_inventory_management/backups/postgres/your_dump_file.dump
```

3) Start the app:
```bash
docker compose -f /data/projects/SaaS/inventory_management/TrackIT_inventory_management/docker-compose.yml start backend frontend
```

If you need a brand-new database instead of overwrite, create it first and
restore without `--clean`.
