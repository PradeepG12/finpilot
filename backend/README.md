# Cyces Django Base

Base project setup for Cyces Django backends. Ships the shared `apps.common` layer
(base models, serializers, views, router, pagination, tasks) and an `apps.access` app
with a custom email-based user model and DRF token authentication.

Rename the project, then start adding your domain apps under `apps/`.

## Prerequisites
1. Python3.13 & Pip3
2. Virtualenv
3. Docker & Docker Compose
4. Postgres & Redis

## Getting Started

### Initial Steps
1. Create a virtual environment in the project root using `virtualenv -p python3 venv`.
2. Activate the environment & install the packages inside `requirements-dev.txt` file.
3. Use [pre-commit](https://pre-commit.com/) to maintain code integrity. Run: `pre-commit install`.
4. Set the necessary `.env` file on the project root. Use `env_example` as reference.

### Basic Development
1. Run the app using `python manage.py init_app && python manage.py runserver`.
2. The app will be running on `http://localhost:8000/`. Now just follow the regular dev process.
3. Other management commands can be run using `python manage.py <command>`.
4. Install redis on your system and handle the background tasks using celery worker and beat.
5. Run the celery worker using `celery -A config worker -l INFO -P solo`
6. Run the celery beat using `celery -A config beat -l INFO`

### Testing
1. Run the suite using `pytest`. It uses `config.settings.test` and a local Postgres.
2. Override the test database with the `TEST_POSTGRES_*` env keys when needed.

## What's Included

### `apps/common`
The shared layer every app builds on. Never inherit raw DRF/Django classes.

| Module | Contents |
|---|---|
| `models/base.py` | `AbstractBaseModel`, `AbstractBaseCMModel`, `AbstractImageOnlyModel`, `AbstractFileUploadModel` and the `COMMON_*` field constants |
| `serializers.py` | `AppSerializer`, `AppReadOnlyModelSerializer`, `AppCreateModelSerializer`, `AppUpdateModelSerializer`, `AppWriteOnlyModelSerializer` |
| `views/` | `AppAPIView`, `NonAuthenticatedAPIMixin`, and the `AppModel*APIViewSet` generics |
| `router.py` | The shared `router` singleton every app registers on |
| `authentication.py` | `AppTokenAuthentication` — DRF token auth with optional idle expiry |
| `tests/base.py` | `AppTestCase`, `AppAPITestCase`, and the `create_user` factory |
| `tasks/` | `AppTask` base for class-based Celery tasks |

### `apps/access`
The user and authentication app.

| Endpoint | Purpose |
|---|---|
| `POST /api/auth/login/` | Email + password login, returns an auth token |
| `POST /api/auth/logout/` | Invalidates the current token |
| `POST /api/auth/change-password/` | Changes the password and rotates the token |
| `GET /api/access/user/profile/` | The authenticated user's own record |
| `GET /api/access/user/list/` | Paginated, filterable user list |
| `/api/access/user/cud/` | Create, update and delete users |

Tokens are sent as `Authorization: Token <key>`. Login rotates the token, so a user
holds one valid token at a time. Set `AUTH_TOKEN_VALIDITY_IN_HOURS` to expire idle
tokens, or leave it at `0` to keep them valid until an explicit logout.

## Renaming for a New Project
1. Set `PROJECT_NAME` in `.env` — it drives the API documentation title.
2. Update the container and network names in `deployment/docker/compose/*.yml` and `deployment/scripts/init.sh`.
3. Update `POSTGRES_DB` in `.github/workflows/tests.yml`.
