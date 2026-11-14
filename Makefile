.PHONY: up down build migrate seed test lint openapi psql shell logs

up:
	docker compose up --build

up-d:
	docker compose up --build -d

down:
	docker compose down

down-v:
	docker compose down -v

build:
	docker compose build

migrate:
	docker compose exec api python manage.py migrate

seed:
	docker compose exec api python manage.py seed_data

test:
	cd backend && python -m pytest apps/ --cov=apps --cov-report=term-missing -v

lint:
	cd backend && black --check . && isort --check . && flake8 . && ruff check .

openapi:
	docker compose exec api python manage.py spectacular --file /app/../docs/api/openapi.yaml --validate

psql:
	docker compose exec db psql -U finpilot finpilot

shell:
	docker compose exec api python manage.py shell

logs:
	docker compose logs -f api
