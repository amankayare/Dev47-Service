# Dev47 Service

Standalone Python backend for the Dev47 portfolio application. The current
production-style API is Flask with SQLAlchemy. This repository also contains an
early Cloudflare Python Worker adapter; it is not yet a replacement for the
Flask API.

For local setup, database instructions, environment variables, and
configuration locations, see the [Developer Guide](DEVELOPMENT.md).

## Runtime status

| Runtime | Current status | Database |
| --- | --- | --- |
| Local development | Flask API launched and debugged in PyCharm Community | Cloudflare D1 over HTTP, SQLite, or PostgreSQL |
| Containerized environment | Optional Docker Compose stack, separate from the local PyCharm workflow | PostgreSQL 16 container |
| Hostinger / VPS | Flask can be run with Gunicorn; deployment pipeline for this standalone repository is not configured here | Configure a separately managed PostgreSQL database |
| Cloudflare Workers (Python prototype) | Health endpoint only; not a replacement API | Worker has no D1 binding |
| Cloudflare Workers (TypeScript migration) | Complete API route parity achieved in `worker-api/` (54 routes mapped). Implemented: health probes, database provider foundation, schemas, snapshot/migration tooling, authentication & authorization, projects, about, certifications, experiences, technical skills, contact messages, admin management, blog categories, comments, blogs, AI blog conversion, resume & file uploads with durable storage abstraction (R2/local/memory), and Polyglot Storage integration. Operational qualification, remote data rehearsal, and traffic cutover remain gated. | Native D1 binding is configured in `worker-api/wrangler.jsonc`; SQLite and PostgreSQL providers are available for Node.js |

All Flask routes use the SQLAlchemy ORM. Select `DATABASE_BACKEND=sqlalchemy`
to connect through `DATABASE_URL`, or `DATABASE_BACKEND=cloudflare_d1` to send
the ORM's SQLite-compatible SQL to Cloudflare D1 over its HTTP API. This is the
legacy Flask provider only; it is not the target architecture. The new
TypeScript API uses a native D1 Worker binding and does not use Cloudflare API
tokens for database access. See the [migration audit](MIGRATION_AUDIT.md) and
[frontend integration guide](FRONTEND_INTEGRATION.md) for scope and known
runtime limitations.

## Quick start: PyCharm Community

Run Flask directly on your machine so PyCharm Community can debug it with
breakpoints. Docker is not required for this workflow. Choose the database
provider in `.env`: configure Cloudflare credentials for D1, or start a local
SQLite/PostgreSQL database and set `DATABASE_URL`.

From the repository root, install the project dependencies and create your
local environment file:

```powershell
uv sync
Copy-Item .env.example .env
```

Configure `.env` as described in the [Developer Guide](DEVELOPMENT.md). Open
this repository in PyCharm Community and set the project interpreter to the
repository's `.venv` environment (`.venv\Scripts\python.exe` on Windows). The
shared **Flask API** run configuration uses the project interpreter and loads
`.env` through the application's existing `python-dotenv` setup.

If this is a new database, create the model tables once:

```powershell
uv run python -c "from app import app; from models import db; app.app_context().push(); db.create_all()"
```

Select **Flask API** in the run-configuration menu and click **Debug** to start
the server with PyCharm breakpoints enabled. The API listens on
`http://127.0.0.1:5000`; Swagger UI is at `http://127.0.0.1:5000/apidocs`.
The run configuration disables Flask's own debugger and reloader so the local
PyCharm debugger controls execution in one process. No separately installed
`debugpy` package or exposed debug port is needed for this workflow.

## Optional containerized environment: Docker Compose

The Compose stack below remains separate from the recommended local PyCharm
workflow. It is a development-configured container stack, not a production
deployment configuration.

### Prerequisites

- Git
- Docker Desktop with the Linux container engine running
- Docker Compose v2 (`docker compose`)

### Start Flask and PostgreSQL

From the repository root:

```bash
docker compose up --build
```

The API is available at `http://localhost:5000`; Swagger UI is at
`http://localhost:5000/apidocs` (no trailing slash). The backend container
mounts the repository for development, and Flask reloads when Python source
files change. PostgreSQL is available to host tools at `localhost:5432`.

Compose waits for PostgreSQL, then runs a one-shot `db-init` service to create
missing model tables before starting the API. This uses SQLAlchemy
`create_all`: it does not migrate existing schemas or load sample data.
`init_db.py` drops and recreates tables and inserts sample records. It is
destructive: run it only against a disposable local database.

The backend runs API-only, so `http://localhost:5000/` is expected to return
404. Start the standalone UI separately on port 3000 to access the application.
The Docker health check uses `/health`; `/api/health` is the lightweight API
health endpoint.

### Common Docker commands

```bash
# See service status
docker compose ps

# Follow backend logs
docker compose logs -f backend

# Run the health-contract tests
docker compose exec backend uv run --no-sync python -m unittest discover -s tests -p "test_health_contract.py"

# Run the database-provider tests
docker compose exec backend uv run --no-sync python -m unittest discover -s tests -p "test_database.py"

# Stop containers; keep PostgreSQL data
docker compose down

# Destructively remove containers and the local PostgreSQL volume
docker compose down --volumes
```

The Compose stack uses development-only credentials and is not a production
deployment configuration. The named `postgres-data` volume preserves database
data across container restarts. The source bind mount also exposes local
`uploads/` files to the backend container.

Change the host ports if `5000` or `5432` is already in use:

```powershell
$env:API_PORT = "5001"
$env:POSTGRES_PORT = "5433"
docker compose up --build
```

Compose reads these port overrides from the invoking shell. The repository
`.env` file is for the native Flask setup; it does not override the explicit
environment configured for Compose.

## Native Flask environment

The local Flask run uses the provider selected in `.env`. For a local
SQLAlchemy/SQLite run, configure:

Edit `.env` with a valid local `DATABASE_URL`, for example:

```env
DATABASE_BACKEND=sqlalchemy
DATABASE_URL=sqlite:///instance/portfolio.db
ENVIRONMENT=dev
SERVE_FRONTEND=false
```

For Cloudflare D1, use `DATABASE_BACKEND=cloudflare_d1` and configure the
Cloudflare account, database ID, and API token as described in the
[Developer Guide](DEVELOPMENT.md).

Start the API with the **Flask API** PyCharm run configuration described above.
Create tables before calling data-backed routes. For a separate frontend
development server, configure its `VITE_API_BASE_URL` to the backend API
origin.

## Debugging

Use PyCharm Community's **Debug** action with the **Flask API** run
configuration for local breakpoints. This runs the Python process on the host;
it does not attach to a container or open a remote-debug port. Keep the
Werkzeug/Flask interactive debugger disabled outside local development.

## Tests and checks

Run the focused tests on the host after `uv sync`:

```bash
uv run python -m unittest discover -s tests -p "test_health_contract.py"
uv run python -m unittest discover -s tests -p "test_database.py"
```

The Worker route handler is also covered by `test_health_contract.py`; this
does not validate the Cloudflare runtime simulator or a live deployment.

## Configuration

Copy `.env.example` for native development and never commit `.env` or real
credentials. Important settings include:

| Variable | Purpose |
| --- | --- |
| `ENVIRONMENT` | Environment label: `dev`, `stg`, or `prod`. Use `prod` only with production secrets and settings. |
| `DATABASE_BACKEND` | `sqlalchemy` to connect through `DATABASE_URL`; `cloudflare_d1` to send all Flask ORM queries to D1 over HTTP |
| `DATABASE_URL` | SQLAlchemy connection string for SQLite or PostgreSQL; ignored when `DATABASE_BACKEND=cloudflare_d1` |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, `CLOUDFLARE_API_TOKEN` | Credentials and target database ID used by `cloudflare_d1` |
| `SECRET_KEY`, `JWT_SECRET` | Flask and JWT secrets; set unique, strong secrets outside local development |
| `SERVE_FRONTEND` | Set to `false` when frontend and backend are deployed separately |
| `FRONTEND_URL`, `FRONTEND_ORIGIN`, `CORS_ORIGINS` | Frontend origin and allowed CORS origins |
| `UPLOAD_FOLDER` | Local upload directory; production uploads need durable shared storage |
| `GEMINI_API_KEY`, `POLYGLOT_API_KEY` | Optional integration credentials; store as deployment secrets |

Do not put secrets in Docker build arguments, source files, images, or frontend
`VITE_*` variables. The Compose file intentionally supplies local-only
credentials directly and should not be reused for a public deployment.

## API and health checks

- `GET /api/health` returns the shared lightweight API response.
- `GET /health` checks the configured database provider and is used as the
  Docker health check.
- `GET /apidocs` serves Swagger UI when the Flask API is running.

## Cloudflare Python Worker

The early Python Worker prototype is in `cloudflare/`. It currently supports
only `GET /api/health`, using shared response logic from `backend_core/`. Other
API routes, auth, uploads, and D1 access are not implemented there.

Prerequisites are Node.js, Python 3.13 or newer, and `uv` 0.13.4 or newer. From
the Worker project directory:

```bash
Set-Location cloudflare
uv sync
uv run pywrangler dev
```

The Worker development server is expected to listen on
`http://localhost:8787`. On Windows, local runtime startup has not yet been
verified because Pywrangler could not locate its Pyodide interpreter. The
Worker needs a configured D1 binding and more migrated routes before it is
ready for deployment as the application API.

## TypeScript Worker API migration

The standalone Next.js API project is in `worker-api/`; it does not contain or
serve the React frontend. Implemented components include health endpoints, a
centralized provider factory, native D1 prepared-statement and batch support,
local SQLite and PostgreSQL providers, initial schema migrations, and the full
authentication route family (compatible with Werkzeug password hashing and
HS256 PyJWT bearer tokens). Remaining Flask application routes, durable uploads,
and integrations remain unported; do not route production traffic to this project
yet. Portable snapshot export, guarded SQL import, D1 import generation, and
snapshot verification/comparison commands are implemented, but no real source
database has been migrated.

From `worker-api/`, configure `.env` based on `.env.example`, then run:

```powershell
npm install
npm run dev
npm test
npm run cf:preview
```

Local Wrangler currently uses a placeholder D1 ID in `wrangler.jsonc`; replace
it with the `dev-47-local` database ID only after reviewing the data migration
plan. The SQL provider uses `DATABASE_URL` for local SQLite/PostgreSQL.
Cloudflare Workers PostgreSQL requires a configured Hyperdrive binding.
SQLite filesystem databases are supported only in local Node.js, not as durable
Worker storage. Production deployment is intentionally not performed.
See [DATA_MIGRATION_RUNBOOK.md](DATA_MIGRATION_RUNBOOK.md) for the guarded
backup, verification, and rollback process; no data has been exported or
changed from the real source or a remote database. Disposable fixtures and a
local Wrangler D1 database have been used for validation only.
The new database health probe is `GET /api/health/database`; the legacy
`GET /api/health` response remains lightweight and database-independent.

## TypeScript migration handoff

The migration remains an additive replacement project: keep Flask, its
database, and existing deployment workflow working until the Worker API has
route parity and a separately approved cutover. The staged plan is:

1. Read [MIGRATION_AUDIT.md](MIGRATION_AUDIT.md),
   [worker-api/README.md](worker-api/README.md),
   [FRONTEND_INTEGRATION.md](FRONTEND_INTEGRATION.md), and
   [DATA_MIGRATION_RUNBOOK.md](DATA_MIGRATION_RUNBOOK.md). Check the worktree
   before editing; it may contain uncommitted changes.
2. Implement and verify auth compatibility: existing JWT HS256 claims,
   `JWT_SECRET` configuration, bearer-token behavior, and Werkzeug password
   hash verification. Preserve Flask behavior and frontend response shapes.
3. Port the Flask API route families from `routes/` to `worker-api/` in
   manageable groups. The legacy route sources are
   `routes/*.py`, `app.py`, `models.py`, `schemas.py`, and `utils/`. Compare
   methods, paths, input/output shapes, HTTP status codes, and authorization
   with the audit and frontend callers before marking each family complete.
4. Ensure every route uses the shared TypeScript database-provider interface;
   verify both native D1 binding behavior and supported local SQL providers.
5. Add local/Worker durable upload adapters (R2 for Workers), then migrate
   Gemini, Email Microservice, and Polyglot Storage integrations. Keep secrets
   in environment/secret configuration, never source or committed examples.
6. Update this README, the Worker README, and migration audit as each slice
   lands. Add focused tests and run the applicable checks after each coherent
   implementation batch.
7. Leave PostgreSQL-on-Workers Hyperdrive validation, actual source-backup
   rehearsal, remote D1 changes, deployment, and production cutover as explicit
   gates. Do not access or modify a remote/production database or switch
   traffic without the owner's separate approval.

Current worktree validation: the latest changes passed 45 Worker tests
(including 18 auth route contract tests, 7 JWT tests, 4 Werkzeug password tests,
and 16 database/migration tests), 16 Python tests, TypeScript checking (`tsc --noEmit`),
Next.js/OpenNext Cloudflare build (`npm run cf:build`), and `git diff --check`.
This validates auth parity and database foundations, but does not constitute
full route parity, PostgreSQL runtime qualification, a real data migration, or
deployment validation.

## Deployment notes for DevOps

This repository does not currently contain a standalone Hostinger deployment
workflow. The older `deploy.yml` in the original Dev47 monorepo deploys that
monorepo; it does not deploy this repository.

For a Flask/VPS deployment:

1. Build and deploy this repository using an environment-specific release
   process; do not run the debug Compose command in production.
2. Provide `ENVIRONMENT=prod`, strong unique secrets, an explicit
   `DATABASE_URL`, and only the required CORS origins through the secret
   manager.
3. Run Flask behind a production WSGI server such as Gunicorn, for example:

   ```bash
   uv run gunicorn -w 4 -b 0.0.0.0:5000 app:app
   ```

4. Configure TLS termination/reverse proxy, database backups and migrations,
   log collection, health monitoring, and durable upload storage separately.
5. Keep database credentials and uploads out of the container image. Test
   schema changes and restore procedures before production rollout.

For Cloudflare Workers deployment, use the TypeScript API project and
Cloudflare bindings—not the local Docker Compose stack. API routes, D1
migrations, secrets, and durable upload storage must be implemented and
validated before switching frontend traffic to Workers.

## Project layout

```text
app.py                 Flask app and route registration
config.py              Flask configuration
routes/                Flask API endpoints
models.py              SQLAlchemy models
database.py            SQLAlchemy and D1 HTTP provider implementations
backend_core/           Framework-independent shared backend behavior
cloudflare/             Early Cloudflare Python Worker host adapter
worker-api/             Standalone Next.js/TypeScript Worker API migration
MIGRATION_AUDIT.md      Backend/frontend audit and provider compatibility plan
DATA_MIGRATION_RUNBOOK.md Data migration safety, verification, and rollback gates
FRONTEND_INTEGRATION.md Frontend API compatibility and CORS guidance
tests/                  Focused unittest coverage
compose.yaml            Local Flask + PostgreSQL development stack
Dockerfile              Local backend development image
```
