# Developer Guide

This guide covers local development of the Flask API on Windows with PyCharm
Community. The local API and debugger run on the host. Docker Compose is a
separate container workflow; do not use it to start the API when debugging
locally in PyCharm.

## 1. Prerequisites

- Git
- Python 3.9 or newer
- [uv](https://docs.astral.sh/uv/getting-started/installation/)
- PyCharm Community
- A database: Cloudflare D1 credentials, or a local/remote SQLite or PostgreSQL database

## 2. Set up the project

Open the repository root (`Dev47-Service`) in PyCharm. From that directory,
install the locked Python dependencies and create your local environment file:

```powershell
uv sync
Copy-Item .env.example .env
```

In PyCharm, set the project interpreter to
`.venv\Scripts\python.exe`. The shared **Flask API** run configuration is
stored in `.idea/runConfigurations/Flask_API.xml`; select it from the
run-configuration menu and choose **Debug** to start the API with breakpoints.
It runs Flask on `127.0.0.1:5000` with Flask's own debugger and reloader turned
off, so PyCharm controls the debug session.

## 3. Choose and configure the database provider

### Cloudflare D1

The instructions in this section configure the **legacy Flask API** to use
Cloudflare's D1 HTTP API through its Python adapter. They do not apply to the
new TypeScript Worker API, which uses a native D1 binding and no Cloudflare API
token. See [the TypeScript API setup](#6-run-the-typescript-worker-api) below.

To debug the Flask API against your `dev-47-local` D1 database, set these
values in the root `.env`:

```env
DATABASE_BACKEND=cloudflare_d1
CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id
CLOUDFLARE_D1_DATABASE_ID=your-dev-47-local-database-id
CLOUDFLARE_API_TOKEN=your-scoped-cloudflare-api-token
CLOUDFLARE_D1_TIMEOUT=10
```

Use the database's ID from the Cloudflare dashboard; `dev-47-local` is its
name, not its ID. Create a scoped API token with D1 Read and D1 Write
permissions. Keep the token only in `.env`, which is ignored by Git. When this
backend is selected, `DATABASE_URL` is ignored and the SQLAlchemy ORM's
SQLite-compatible statements are sent to the configured D1 database over
Cloudflare's HTTP API. The API does not connect to a local D1 server.

Before using routes against a new D1 database, create any missing model tables
there. This command makes remote schema changes to the database selected in
`.env`; verify the D1 ID first:

```powershell
uv run python -c "from app import app; from models import db; app.app_context().push(); db.create_all()"
```

`db.create_all()` only creates missing tables; it does not migrate changed
tables or insert sample data. `init_db.py` drops tables and is destructive—do
not run it against a shared or production D1 database.

The D1 HTTP API executes SQL statements remotely. SQLAlchemy's normal
multi-statement transaction rollback guarantees do not apply across separate
HTTP requests, so a failed multi-write operation may leave earlier writes
committed. D1's batch endpoint is used for DBAPI `executemany` batches, but it
does not make every multi-statement ORM request atomic. Keep this limitation in
mind when testing changes that write related records.

### SQLite or PostgreSQL through SQLAlchemy

Set `DATABASE_BACKEND=sqlalchemy` and configure `DATABASE_URL`. The current
example uses a local SQLite file:

```env
DATABASE_BACKEND=sqlalchemy
DATABASE_URL=sqlite:///instance/portfolio.db
```

For PostgreSQL, install and start it on the host, create a database and role,
then set a PostgreSQL connection URL, for example:

```env
DATABASE_URL=postgresql://portfolio:your-local-password@localhost:5432/portfolio
```

If the password contains URL-reserved characters, percent-encode them in
`DATABASE_URL`. Keep `.env` local; it is ignored by Git. Never put real
credentials in `.env.example`, source code, or a committed IDE configuration.

For a new, empty SQLite or PostgreSQL database, create the tables represented
by the SQLAlchemy models:

```powershell
uv run python -c "from app import app; from models import db; app.app_context().push(); db.create_all()"
```

`db.create_all()` creates missing tables but does not migrate existing ones or
insert example data. `init_db.py` drops and recreates tables and inserts sample
records; it is destructive and should only be used with a disposable database.
The project does not currently have a schema migration workflow, so coordinate
schema changes carefully.

## 4. Connect to the database and run SQL

PyCharm Community does not include PyCharm Professional's database browser.
For SQLite or PostgreSQL, use a database client or CLI. For Cloudflare D1, use
the D1 Console's SQL editor or Wrangler; `psql` cannot connect directly to D1.

For PostgreSQL installed on the host, use the host, port, database, and
credentials from `DATABASE_URL` in the root `.env`. For example:

| Connection field | Example |
| --- | --- |
| Host | `localhost` |
| Port | `5432` |
| Database | `portfolio` |
| Username | `portfolio` |
| Password | The password configured for the `portfolio` database role |

In pgAdmin, register a server and enter these values under **Connection**.
Alternatively, open PowerShell in the repository and connect with `psql`:

```powershell
psql -h localhost -p 5432 -U portfolio -d portfolio
```

Enter the role password when prompted. At the `portfolio=>` prompt, you can
run queries such as:

```sql
\dt
SELECT * FROM projects LIMIT 10;
```

Type `\q` to exit `psql`. If `psql` is not recognized, install PostgreSQL's
command-line tools or use pgAdmin.

If PostgreSQL is running through Docker Compose, first start its database
service with `docker compose up -d db`. From a client on the Windows host, use
`localhost` and the published port (default `5432`), with database `portfolio`,
user `portfolio`, and the local-only password `local-dev-only`. Inside another
Compose container, use host `db` and port `5432` instead. Do not use the
container hostname `db` from a host-side SQL client.

The database health URL (`/health`) only reports connectivity; it is not a SQL
console. For D1, the Wrangler command-line client can issue a remote query:

```powershell
npx wrangler d1 execute dev-47-local --remote --command "SELECT * FROM projects LIMIT 10"
```

You can also run SQL in the D1 Console for the `dev-47-local` database. Do not
put API tokens directly on the command line.

## 5. Run and debug Dev47-Service

### Start with PyCharm Community

1. Configure the selected provider in `.env`: D1 credentials for `cloudflare_d1`,
   or a reachable `DATABASE_URL` for `sqlalchemy`.
2. Open the `Dev47-Service` repository root in PyCharm.
3. Configure the project interpreter as the repository's `.venv\Scripts\python.exe`.
   If `.venv` does not exist yet, run `uv sync` from the repository root.
4. In the run-configuration selector, select **Flask API**. If it is not shown,
   open **Run > Edit Configurations** and add the shared configuration from
   `.idea/runConfigurations/Flask_API.xml` (or reload the project).
5. Click **Run** to start normally, or **Debug** to start with PyCharm
   breakpoints and step-through debugging.

The shared configuration runs `python -m flask --app app run` from the project
root, binds only to `127.0.0.1:5000`, and disables Flask's interactive
debugger and reloader. PyCharm attaches its debugger when you choose **Debug**;
do not add `debugpy` or an attach port for this local workflow. Set a
breakpoint in a route or other code that is executed by a request, start with
**Debug**, then send a request to that route to hit the breakpoint.

To run without opening PyCharm, use this equivalent command in PowerShell from
the repository root:

```powershell
uv run python -m flask --app app run --host=127.0.0.1 --port=5000 --no-debugger --no-reload
```

Stop the server with the red **Stop** button in PyCharm or press `Ctrl+C` in
PowerShell. The API and Swagger UI are at:

- API base: `http://127.0.0.1:5000`
- Lightweight API health: `http://127.0.0.1:5000/api/health`
- Database health: `http://127.0.0.1:5000/health`
- Swagger UI: `http://127.0.0.1:5000/apidocs`

The backend is API-only when `SERVE_FRONTEND=false`; a root URL or UI route
returning 404 in that mode is expected. Run the frontend separately and set its
`VITE_API_BASE_URL` to the backend origin.

If startup fails, check that the selected database is reachable and the
provider settings in `.env` are correct. For D1, verify the account ID,
database ID, and API token permissions. For SQLAlchemy, verify that the
database/role exist and `DATABASE_URL` is correct. If port 5000 is
already in use, stop the other server or change the port in the **Flask API**
run configuration and use the same port for the URL above. After editing
`.env`, stop and restart the run configuration so the app loads the new values.

Run the focused tests from the repository root:

```powershell
uv run python -m unittest discover -s tests -p "test_health_contract.py"
uv run python -m unittest discover -s tests -p "test_database.py"
```

## 6. Run the TypeScript Worker API

The Next.js API is a separate application under `worker-api/`; it does not
replace Flask yet and does not include the frontend. From that directory:

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

The Next.js server listens at `http://localhost:3000`; the health endpoints
are `/api/health` and `/api/health/database`. With
`DATABASE_BACKEND=cloudflare_d1`, the dev integration loads the local Wrangler
D1 database, separate from the Cloudflare-hosted `dev-47-local` data. Use
Wrangler preview to validate the Worker runtime:

```powershell
npm run cf:preview
```

The `worker-api/wrangler.jsonc` D1 ID is still a placeholder. Initial schema
migrations now exist and the SQLite/D1 schema is tested against the Flask
models, but the data importer and end-to-end verification are not implemented.
Do not point it at the remote database or deploy it until the correct ID and
a reviewed data-migration plan are in place. See
[DATA_MIGRATION_RUNBOOK.md](DATA_MIGRATION_RUNBOOK.md) for safety gates and
rollback requirements.

For a new local Wrangler D1 database, apply the schema from `worker-api/`:

```powershell
npx wrangler d1 migrations apply dev-47-local --local
```

For a new SQLite or PostgreSQL target, set `DATABASE_BACKEND=SQLAlchemy` and
the desired `DATABASE_URL` in `worker-api/.env`. Then explicitly confirm
schema creation:

```powershell
$env:DATABASE_MIGRATION_CONFIRM = "apply"
npm run db:migrate:sql
Remove-Item Env:DATABASE_MIGRATION_CONFIRM
```

The SQL runner stores a migration version and applies the initial schema in a
transaction. It is only for a new target schema; do not run it against an
existing database lacking a migration record.

The TypeScript provider selection is global:

```env
DATABASE_BACKEND=cloudflare_d1
```

selects the native D1 binding, while:

```env
DATABASE_BACKEND=SQLAlchemy
DATABASE_URL=sqlite:///./dev47-local.sqlite
```

selects the TypeScript SQL provider. The `SQLAlchemy` spelling is retained for
compatibility with the requested configuration; it does not run the Python
SQLAlchemy library. SQLite is local Node.js only. For local PostgreSQL, use a
`postgresql://` URL. PostgreSQL on Workers requires a Hyperdrive binding;
`USE_HYPERDRIVE=true` alone is not enough because the binding is not configured
in Wrangler yet. Keep connection strings and secrets in `worker-api/.env` or
deployment secrets, never committed files.

Run provider tests and a TypeScript check from `worker-api/`:

```powershell
npm test
npx tsc --noEmit
```

The migration currently includes provider foundation and health only. Flask
route families, auth, data migrations, uploads, and external integrations have
not yet been ported. See [MIGRATION_AUDIT.md](MIGRATION_AUDIT.md) and
[worker-api/README.md](worker-api/README.md) for status and setup details.

## 7. Change application settings

The application loads the root `.env` using `python-dotenv` in `config.py`.
Settings are read when the application imports, so stop and restart the
PyCharm run after changing `.env`. Environment variables already set by the
launching process take precedence over values in `.env`.

Use `.env` for machine-specific values and credentials, such as database
connection details, API tokens, local ports, and development feature flags.
Use `.env.example` to document the variable names and safe placeholder values
needed by a new developer. Do not copy real values into the example file.

Common settings:

| Variable | Purpose |
| --- | --- |
| `ENVIRONMENT` | Environment label: `dev`, `stg`, or `prod`. `dev` enables development defaults; `stg` and `prod` use non-development logging/debug defaults, and production-only validation runs for `prod`. Former values `development`, `stage`/`staging`, and `production` are normalized for compatibility. |
| `DATABASE_BACKEND` | `sqlalchemy` to use the database URL, or `cloudflare_d1` to route ORM SQL through Cloudflare's D1 HTTP API. |
| `DATABASE_URL` | SQLAlchemy connection string for SQLite or PostgreSQL; ignored for the D1 backend. |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, `CLOUDFLARE_API_TOKEN` | Credentials and target ID for the D1 HTTP backend. |
| `SECRET_KEY`, `JWT_SECRET` | Flask and JWT signing secrets. Use unique values outside throwaway local development. |
| `ADMIN_USERNAME` | Configured administrator username. |
| `SERVE_FRONTEND` | `false` to run the API without serving the frontend build. |
| `FRONTEND_URL`, `FRONTEND_ORIGIN`, `CORS_ORIGINS` | Frontend URL and allowed browser origins. `CORS_ORIGINS` is a comma-separated list. |
| `UPLOAD_FOLDER`, `MAX_CONTENT_LENGTH` | Upload storage path and maximum request size in bytes. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Optional Gemini integration settings. |
| `POLYGLOT_URL`, `POLYGLOT_API_KEY` | Optional Polyglot integration settings. |
| `LOG_LEVEL`, `LOG_FILE` | Application logging level and optional log-file path. |
| `DEBUG`, `THREADED` | Flask/application behavior settings. These do not enable PyCharm debugging; use the PyCharm **Debug** action. |

For a setting to become configurable, add its default and parsing/validation in
`config.py`, document it in `.env.example`, and update this table when useful.
Avoid putting environment-specific values in Python source.

## 7. Where project configuration belongs

| Change | Location |
| --- | --- |
| Local secrets and environment-specific values | Root `.env` (untracked) |
| Safe list of required environment variables | Root `.env.example` |
| TypeScript Worker API local settings | `worker-api/.env` (untracked); safe template in `worker-api/.env.example` |
| TypeScript Worker bindings and non-secret runtime settings | `worker-api/wrangler.jsonc` |
| Environment-variable defaults and validation | `config.py` |
| PyCharm project interpreter | PyCharm project settings; use the repository `.venv` |
| Shared PyCharm Flask run/debug profile | `.idea/runConfigurations/Flask_API.xml` |
| Personal IDE state and local paths | PyCharm user/workspace settings; do not commit machine-specific values |
| Python dependencies | `pyproject.toml`, then update `uv.lock` with `uv lock` |
| Flask routes and API registration | `routes/` and `app.py` |
| SQLAlchemy tables and relationships (used by both backend adapters) | `models.py` |
| Docker image and Compose services | `Dockerfile` and `compose.yaml`; these do not configure the local PyCharm run |
| Tests | `tests/` |

## 8. Docker Compose and remote environments

Docker Compose is not part of the local PyCharm debugging workflow above. The
current `compose.yaml` starts both the backend container and PostgreSQL, using
development-only credentials and explicit container environment values. Compose
uses the root `.env` for interpolation such as `API_PORT` and `POSTGRES_PORT`;
it does not pass the native app's `.env` settings through to the containers.
Neither file is a substitute for configuring a remote server. Do not deploy the
current Compose credentials or Flask development/debug settings publicly.

For a remote deployment, provide environment variables and secrets through the
server's secret manager or deployment environment, use strong unique secrets,
and run Flask behind a production WSGI server such as Gunicorn. Keep production
configuration separate from local `.env` and the development Compose defaults.
