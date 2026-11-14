# FinPilot

**Internal Investment Portfolio & Goal Monitoring Web App**

Stack: Django 5 + DRF (JWT) + PostgreSQL 16 + React (TypeScript, Vite) + Docker Compose

> **Data freshness note:** The seed data is dated 2026-09-18. "Today" is later, so the Data Freshness Banner will correctly show the data as stale (amber "N days old"). This is intentional — see `docs/DECISIONS.md`.

---

## Prerequisites

- Docker Desktop ≥ 4.x (with Compose v2)
- Git

---

## Quick Start (one command)

```bash
git clone <repo-url>
cd finpilot
cp .env.example .env
docker compose up --build
```

Then open:
- **App:** http://localhost:8080
- **API:** http://localhost:8080/api/v1/
- **Swagger:** http://localhost:8080/api/v1/docs/

Demo credentials (created automatically on first boot):
| Role  | Email                    | Password                  |
|-------|--------------------------|---------------------------|
| Admin | admin@finpilot.local     | Admin@1234!ChangeMeInProd |
| Viewer| viewer@finpilot.local    | Viewer@1234!ChangeMeInProd |

> These are defined in `.env.example`. Never use these in production.

---

## URLs

| Service | URL |
|---------|-----|
| Frontend (nginx) | http://localhost:8080 |
| API (direct) | http://localhost:8000/api/v1/ |
| Swagger UI | http://localhost:8080/api/v1/docs/ |
| OpenAPI schema | http://localhost:8080/api/v1/schema/ |
| Health | http://localhost:8080/api/v1/health/ |
| Readiness | http://localhost:8080/api/v1/health/ready/ |

---

## Development (hot reload)

```bash
cp .env.example .env
# Edit .env: set POSTGRES_HOST=localhost, ENVIRONMENT=local
docker compose up db -d          # just the database
cd backend
pip install -r requirements-dev.txt
python manage.py init_app        # migrate + create users
python manage.py seed_data       # load CSV data
python manage.py runserver       # API on :8000

cd ../frontend
npm install
npm run dev                      # Vite on :5173
```

---

## Seed Data

The seed command imports the 8 raw CSVs from `data/seed/` in FK-safe order:

```bash
python manage.py seed_data
```

**Golden totals (acceptance criteria):**
- Customers: 120 imported
- Accounts: 167 imported
- Instruments: 80 imported
- Risk Profiles: 120 imported
- Goals: 177 imported
- Holdings: 982 imported + 3 skipped duplicates
- Transactions: 4550 imported + 1 skipped duplicate + 3 rejected

---

## Run Tests

```bash
cd backend
pytest apps/ --cov=apps --cov-report=term-missing
```

## Lint

```bash
cd backend
black --check .
isort --check .
flake8 .
ruff check .
```

---

## Make Targets

```bash
make up        # docker compose up --build
make down      # stop containers
make migrate   # run migrations
make seed      # run seed_data
make test      # run pytest
make lint      # run all linters
make openapi   # export openapi.yaml
make psql      # open psql shell
make shell     # open Django shell
make logs      # follow api logs
```

---

## Architecture

See `docs/architecture/ARCHITECTURE.md` for the full architecture report (also exported as PDF/DOCX).

---

## Decisions & Assumptions

See `docs/DECISIONS.md` for all design decisions, deliberate omissions, and known limitations.

---

## Troubleshooting

**DB not ready on startup:** The API container waits for `pg_isready`. If it times out, re-run `docker compose up`.

**Migrations pending:** Run `make migrate` or `docker compose exec api python manage.py migrate`.

**Seed data already loaded:** `seed_data` is idempotent — running twice produces 0 new rows.

**Port 8080 in use:** Change the port in `docker-compose.yml` → `web.ports`.

**"Token expired" on page load:** The frontend auto-refreshes the token. If the refresh cookie is missing (cleared browser data), just log in again.
