# Remote Deployment Guide

This guide describes how to deploy TrackIT on a remote machine using Docker Compose,
starting from environment variables.

## 1) Create a working directory

```bash
mkdir -p /opt/trackit
cd /opt/trackit
```

## 2) Create the environment file

Create `/opt/trackit/.env`:

```bash
POSTGRES_DB=trackit_inventory
POSTGRES_USER=trackit_user
POSTGRES_PASSWORD=trackit_password
JWT_ACCESS_SECRET=trackit_access_secret
JWT_REFRESH_SECRET=trackit_refresh_secret
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=1d
DEFAULT_ADMIN_EMAIL=admin@trackit.com
DEFAULT_ADMIN_PASSWORD=admin123
```

## 3) Create docker-compose.yml

Create `/opt/trackit/docker-compose.yml` and replace `<REMOTE_IP>`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 10

  db-init:
    image: docker.io/mlraja/trackit-backend:latest
    command: ["node", "scripts/apply_schema.js"]
    environment:
      PG_URL: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
    depends_on:
      postgres:
        condition: service_healthy
    restart: "no"

  backend:
    image: docker.io/mlraja/trackit-backend:latest
    environment:
      DB_PROVIDER: postgres
      PG_URL: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      CORS_ORIGIN: http://<REMOTE_IP>:3000
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      JWT_ACCESS_TTL: ${JWT_ACCESS_TTL}
      JWT_REFRESH_TTL: ${JWT_REFRESH_TTL}
      DEFAULT_ADMIN_EMAIL: ${DEFAULT_ADMIN_EMAIL}
      DEFAULT_ADMIN_PASSWORD: ${DEFAULT_ADMIN_PASSWORD}
    depends_on:
      db-init:
        condition: service_completed_successfully
    ports:
      - "4000:4000"

  frontend:
    image: docker.io/mlraja/trackit-frontend:latest
    environment:
      VITE_API_URL: http://<REMOTE_IP>:4000
    depends_on:
      - backend
    ports:
      - "3000:3000"

volumes:
  postgres_data:
```

## 4) Pull and start containers

```bash
docker compose pull
docker compose up -d
```

## 5) Optional: migrate data from CSV exports

If you have CSV exports in `/opt/trackit/data_export`:

```bash
docker compose run --rm \
  -v $(pwd)/data_export:/data_export \
  -e MIGRATION_TARGET=local \
  -e VITE_API_URL=http://backend:4000 \
  backend node scripts/migrate_data.js
```

## 6) Verify

- Frontend: `http://<REMOTE_IP>:3000`
- Backend health: `http://<REMOTE_IP>:4000/health`

## 7) Logs and troubleshooting

```bash
docker compose logs -f --tail=200
```
