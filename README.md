# Travel Management System

A multi-tenant travel booking platform built with a microservices architecture.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Services & Ports](#services--ports)
- [Getting Started](#getting-started)
- [Production Deployment](#production-deployment)
- [Database Migration (Prisma)](#database-migration-prisma)
- [Seeding the Super Admin](#seeding-the-super-admin)
- [Environment Variables](#environment-variables)

---

## Architecture Overview

```
Client (Frontend)
      │
      ▼
 API Gateway (4000)
      │
      ├──► Auth Service     (4001)  → DB: travel_platform_auth
      ├──► Booking Service  (4006)  → DB: travel_platform
      └──► ...other services
```

- **Frontend** -- React/Vite app served via Nginx
- **API Gateway** -- Single entry point, routes requests to microservices
- **Auth Service** -- Handles authentication, tenants, platform admins, roles & permissions
- **Booking Service** -- Manages bookings, transactions, agents, wallets
- **PostgreSQL** -- Two separate databases (one per service group)
- **Redis** -- Caching / session store
- **RabbitMQ** -- Async messaging between services
- **MinIO** -- Object storage (logos, media uploads)

---

## Services & Ports

| Service         | Container Name           | Host Port | Internal Port |
| --------------- | ------------------------ | --------- | ------------- |
| Frontend        | `travel_frontend`        | `5173`    | `80`          |
| API Gateway     | `travel_api_gateway`     | `4000`    | `4000`        |
| Auth Service    | `travel_auth_service`    | `4001`    | `4001`        |
| Booking Service | `travel_booking_service` | `4006`    | `4005`        |
| PostgreSQL      | `travel_postgres`        | `5432`    | `5432`        |
| Adminer (DB UI) | `travel_adminer`         | `8085`    | `8080`        |
| Redis           | `travel_redis`           | `6379`    | `6379`        |
| RabbitMQ        | `travel_rabbitmq`        | `5672`    | `5672`        |
| RabbitMQ UI     | `travel_rabbitmq`        | `15672`   | `15672`       |
| MinIO API       | `travel_minio`           | `9010`    | `9000`        |
| MinIO Console   | `travel_minio`           | `9011`    | `9001`        |

---

## Getting Started

### Prerequisites

- Docker & Docker Compose installed
- Ports listed above must be free

### Run All Services

```bash
docker-compose up -d --build
```

### Stop All Services

```bash
docker-compose down
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f auth-service
```

---

## Production Deployment

### 1. Deploy containers

```bash
docker-compose up -d --build
```

### 2. Run database migrations (IMPORTANT -- do this after first deploy)

See [Database Migration](#database-migration-prisma) section below.

### 3. Seed the Super Admin

See [Seeding the Super Admin](#seeding-the-super-admin) section below.

---

## Database Migration (Prisma)

The **Auth Service** uses its own database (`travel_platform_auth`).  
After deploying for the first time (or after schema changes), you must run migrations to create all tables.

### Option 1 -- Recommended: `prisma migrate deploy`

Run this on your production server:

```bash
docker exec -it travel_auth_service npx prisma migrate deploy
```

### Option 2 -- If no migrations folder: `prisma db push`

If there is no `prisma/migrations` folder, use `db push` to sync the schema directly:

```bash
docker exec -it travel_auth_service npx prisma db push
```

### Option 3 -- Manual SQL (last resort)

If Prisma is not available inside the container, connect to the database via Adminer at `http://<your-server>:8085` and run:

```sql
CREATE TABLE IF NOT EXISTS "PlatformAdmin" (
  "id"                SERIAL PRIMARY KEY,
  "email"             VARCHAR(255) NOT NULL UNIQUE,
  "encryptedPassword" VARCHAR(255) NOT NULL,
  "name"              VARCHAR(255),
  "createdAt"         TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt"         TIMESTAMP NOT NULL DEFAULT NOW()
);
```

> **Adminer connection details:**
>
> - System: `PostgreSQL`
> - Server: `postgres`
> - Username: `postgres`
> - Password: `password`
> - Database: `travel_platform_auth`

---

## Seeding the Super Admin

The `PlatformAdmin` table holds the top-level admin credentials (not tied to any tenant).

### Step 1 -- Generate a bcrypt password hash

Run this inside the auth-service container:

```bash
docker exec -it travel_auth_service node -e "
const bcrypt = require('bcrypt');
bcrypt.hash('YourPassword123!', 10).then(console.log);
"
```

Copy the output hash (starts with `$2b$10$...`).

### Step 2 -- Insert the Super Admin record

Connect to Adminer at `http://<your-server>:8085` and run:

```sql
INSERT INTO "PlatformAdmin" ("email", "encryptedPassword", "name")
VALUES (
  'admin@yourdomain.com',
  '$2b$10$YOUR_BCRYPT_HASH_HERE',
  'Super Admin'
);
```

> Replace `admin@yourdomain.com` and `$2b$10$YOUR_BCRYPT_HASH_HERE` with your actual values.

### Verify the insert

```sql
SELECT id, email, name, "createdAt" FROM "PlatformAdmin";
```

---

## Environment Variables

### Auth Service

| Variable             | Default Value                                                       | Description                     |
| -------------------- | ------------------------------------------------------------------- | ------------------------------- |
| `PORT`               | `4001`                                                              | Service port                    |
| `DATABASE_URL`       | `postgresql://postgres:password@postgres:5432/travel_platform_auth` | Auth database connection string |
| `JWT_SECRET`         | `super_secret_jwt_key`                                              | JWT signing secret              |
| `MINIO_ENDPOINT`     | `minio`                                                             | MinIO host                      |
| `MINIO_PORT`         | `9000`                                                              | MinIO port                      |
| `MINIO_ACCESS_KEY`   | `minioadmin`                                                        | MinIO access key                |
| `MINIO_SECRET_KEY`   | `minioadminpassword`                                                | MinIO secret key                |
| `MINIO_BUCKET`       | `travelbooker-media`                                                | MinIO bucket name               |
| `MINIO_EXTERNAL_URL` | `http://localhost:9010`                                             | Public URL for media assets     |

### Booking Service

| Variable           | Default Value                                                  | Description                        |
| ------------------ | -------------------------------------------------------------- | ---------------------------------- |
| `PORT`             | `4005`                                                         | Service port                       |
| `DATABASE_URL`     | `postgresql://postgres:password@postgres:5432/travel_platform` | Booking database connection string |
| `AUTH_SERVICE_URL` | `http://auth-service:4001`                                     | Internal auth service URL          |

---

> **Note:** Change all default passwords and secrets before deploying to a public production environment.
