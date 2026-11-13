# Dev47 Backend Migration Audit

## Scope and status

This audit covers the current worktree in the backend repository and the
separate `D:\Workspace\Dev47-UI` frontend. The backend worktree was already
dirty when this audit began. Existing changes are preserved; this document
does not treat them as committed baseline changes. The frontend repository was
read-only.

The migration has **not** been completed. Flask remains the operating API.
This document records the required audit and the implementation decisions
needed before replacing any existing service.

An initial TypeScript/Next.js Worker API foundation has since been added under
[`worker-api/`](./worker-api/). It implements health routes and database
provider adapters and initial schema migrations, but no Flask application
routes or data migrations.
Flask remains the source of truth and must stay operational through migration.

## Executive summary

- The service has 14 Flask blueprint modules and 71 API route definitions,
  plus the `/api/health` endpoint. Routes contain business logic and call
  SQLAlchemy models and `db.session` directly.
- The current database abstraction has a SQLAlchemy provider and a D1 provider,
  but the current D1 path sends SQL over Cloudflare's HTTP API. That conflicts
  with the required native Workers D1 binding. The existing Python Worker
  project implements only a health endpoint and has no D1 binding.
- The 13 application tables and their relations are defined in
  [`models.py`](./models.py). No versioned migrations for the existing Flask
  database were found. Initial TypeScript D1/SQLite/PostgreSQL schemas have
  been added; `init_db.py` calls `drop_all()` and is destructive, so it must
  not be used for migration or production initialization.
- Authentication is bearer JWT-based. The UI stores access tokens in
  `localStorage`; it does not depend on an HTTP-only auth cookie. Werkzeug
  password hashes and existing JWT secrets must be handled compatibly to
  preserve users and sessions.
- The backend relies on local filesystem uploads, plus Gemini, Email
  Microservice, and Polyglot Storage integrations. Local filesystem writes are
  not durable Workers storage; Workers uploads need an object-storage binding
  (recommended: R2) or an explicitly external storage service.
- The frontend is a separate React/Vite repository and must stay separate. Its
  dev proxy currently targets Flask on port 5000; it uses bearer authorization
  and relies on several exact response shapes documented below and in
  [`FRONTEND_INTEGRATION.md`](./FRONTEND_INTEGRATION.md).

## Existing implementation inventory

| Area | Current status | Findings and migration implication |
| --- | --- | --- |
| Flask application and API | Implemented; requires migration to TypeScript | [`app.py`](./app.py) registers all Flask blueprints, configures CORS and Swagger, optionally serves the UI, and initializes SQLAlchemy. Keep it operational until the replacement passes contract and provider tests. |
| SQLAlchemy database path | Implemented in Python; requires migration to TypeScript | [`database.py`](./database.py) wraps SQLAlchemy connections for provider-level queries, but application routes bypass that provider interface and use the ORM directly. |
| Cloudflare D1 path | Partially implemented; incompatible with target | The dirty worktree has a D1 HTTP client and SQLAlchemy DBAPI bridge. It requires Cloudflare API credentials and does not use a Workers binding. Do not copy this design into the TypeScript service. |
| Python Cloudflare Worker | Partial prototype | [`cloudflare/src/worker.py`](./cloudflare/src/worker.py) exposes the health handler only; [`cloudflare/wrangler.jsonc`](./cloudflare/wrangler.jsonc) has no D1 binding. It is not the replacement backend. |
| Models and schema | Implemented; requires dialect migration | 13 tables, association table, JSON fields, foreign keys, uniqueness constraints, relationships, and serializers are defined in [`models.py`](./models.py). No Alembic or other versioned migrations were found. |
| Auth and authorization | Implemented in TypeScript worker-api | JWT HS256, Basic-auth token issuance, user registration, login, me, profile, change-password, and password reset routes ported to `worker-api/src/app/api/auth/*`. Werkzeug scrypt & pbkdf2 password hash verification/generation and PyJWT HS256 claims compatibility implemented and verified with 29 focused tests. |
| Validation and API docs | Partially implemented | Marshmallow schemas and Flasgger docs exist in Flask. Auth route validation is ported to TypeScript with matching validation error shapes. Other routes remain. |
| Uploads and static files | Implemented on local disk; incompatible with Workers as-is | `routes/upload.py` and `routes/resume.py` write/read files from the Flask static directory. The API also serves upload paths and can serve the frontend. The new service should be API-only and use durable object storage for Worker uploads. |
| AI integration | Implemented; requires runtime/library migration | Blog conversion uses an abstraction and Gemini via LangChain (`utils/ai_service*.py`). Worker-compatible `fetch` calls or a verified compatible client are required. Preserve prompt/output behavior. |
| Email integration | Partially implemented in worker-api | Password reset uses `EMAIL_SERVICE_URL` with `EMAIL_SERVICE_API_KEY` via `worker-api/src/lib/integrations/email-service.ts`. Additional email notification paths to follow. |
| Polyglot Storage integration | Implemented; requires runtime migration | `routes/polyglot.py` proxies multipart uploads, previews, confirmation, and deletion using `POLYGLOT_URL` and `POLYGLOT_API_KEY`. |
| Rate limiting | Configured but not active | Flask-Limiter dependencies/settings exist, but limiter setup in `app.py` is commented out. Do not claim active throttling. Decide and test the replacement's policy rather than silently changing limits. |
| Tests | Expanded | Python unit tests cover configuration, health contracts, and the D1/SQLAlchemy adapters (16 tests); `worker-api` vitest suite covers database providers, schema, migration tools, Werkzeug password verification, JWT utilities, and all auth route contracts (45 tests). |
| Deployment | Partial | Docker Compose targets Flask and PostgreSQL; the Python Worker prototype is health-only. OpenNext Cloudflare Worker builds cleanly for worker-api. Do not remove the Flask/Docker setup until the new service is validated. |
| TypeScript Worker API foundation | Implemented for Health, Database, and Auth | `worker-api/` includes health routes, complete auth route family (`/api/auth/*`), native D1, Node.js SQLite/PostgreSQL providers, initial dialect schemas, snapshot export/import/verification tooling, and local Wrangler rehearsal. Content route families (projects, blogs, about, etc.), durable uploads, and remaining integrations are pending. |

## Flask API inventory

All paths below are under `/api` unless otherwise noted. JSON response shapes
are described by current serializers in `models.py`, route code, and
Flasgger annotations; error bodies/status codes vary by route and must be
preserved from the route implementation rather than normalized incidentally.

| Route(s) | Methods | Request parameters/body | Response contract | Access |
| --- | --- | --- | --- | --- |
| `/health` | GET | None | Health JSON; non-API Flask health route | Public |
| `/health` via API | GET `/api/health` | None | Health JSON and status from `backend_core/health.py` | Public |
| `/auth/token` | POST | HTTP Basic credentials | `{access_token}` | Valid user credentials |
| `/auth/register` | POST | `{username,email,password}` | `{message,user}` | Public |
| `/auth/login` | POST | `{username,password}` (username or email) | `{access_token,user,message}` | Public |
| `/auth/me` | GET | Bearer JWT | `{user}` | JWT |
| `/auth/change-password` | PUT | `{currentPassword,newPassword}` | `{message}` | JWT |
| `/auth/profile` | GET, PUT | PUT accepts username/email | GET returns user; PUT returns `{message,user}` | JWT |
| `/auth/forgot-password` | POST | `{email}` | Generic success message; sends reset email when user exists | Public |
| `/auth/reset-password` | POST | Reset token and new password | Message/error JSON | Public, token-bound |
| `/about/` | GET | None | About object or `{}` | Public |
| `/about/` | POST, PUT, DELETE | About fields (`name`, `headline`, `bio`, image/contact/resume URLs, `social_links`) | About object or message/error JSON | JWT |
| `/projects/` | GET | None | Visible projects array | Public |
| `/projects/featured` | GET | None | Visible featured projects array | Public |
| `/projects/admin` | GET | None | All projects array | Admin JWT |
| `/projects/` | POST | Project fields (including links, tech/media, ordering/visibility) | Created project | Admin JWT |
| `/projects/<project_id>` | PUT, DELETE | Path ID; PUT project fields | Updated object or message/error JSON | PUT requires JWT; DELETE requires JWT and admin |
| `/blogs/` | GET | None | Visible blogs array | Public |
| `/blogs/test` | GET | None | Test message object | Public |
| `/blogs/<blog_id>` | GET | Path ID | Blog object | Public |
| `/blogs/<blog_id>/related` | GET | Path ID | Up to five related blog objects | Public |
| `/blogs/tags/popular`, `/blogs/tags/popular/simple` | GET | None | Tag arrays/statistics | Public |
| `/blogs/admin` | GET | `page`, `page_size`, `search`, `status` | Paginated blogs, counts and current filter | Admin JWT |
| `/blogs/convert` | POST | `raw_text`, optional `custom_system_prompt` | HTML, title/excerpt, reading time, quick links and tags | Admin JWT |
| `/blogs/convert/default-prompt` | GET | None | `{prompt}` | Admin JWT |
| `/blogs/` | POST | Blog fields, category/author/tags, content and metadata | Created blog object | Admin JWT |
| `/blogs/<blog_id>` | PUT, DELETE | Path ID; PUT blog fields | Updated blog or message/error JSON | Admin JWT for PUT; JWT for DELETE |
| `/blog-categories/` | GET, POST | POST `{name}` | Category array/object or message/error JSON | GET public; writes admin JWT |
| `/blog-categories/<category_id>` | PUT, DELETE | Path ID; PUT category fields | Updated category or message/error JSON | Admin JWT |
| `/blogs/<blog_id>/comments` | GET, POST | POST `{content,parent_id?}` | Nested comment array; POST returns created comment | GET public; POST JWT |
| `/comments/<comment_id>` | PUT, DELETE | Path ID; PUT `{content}` | Message/error JSON | JWT; author or admin check |
| `/certifications/` | GET, POST | POST certification fields | Array or created object | GET public; writes admin JWT |
| `/certifications/<cert_id>` | PUT, DELETE | Path ID; PUT certification fields | Updated object or message/error JSON | Admin JWT |
| `/experiences/` | GET | Optional `admin=true` | Experience array, including hidden rows when `admin=true` | Public; query flag itself is not authenticated |
| `/experiences/<experience_id>` | GET | Path ID | Experience object | Public |
| `/experiences/` | POST | Experience fields and dates | `{message,experience}` | Admin JWT |
| `/experiences/<experience_id>` | PUT, DELETE | Path ID; PUT experience fields | `{message,experience}` or message/error JSON | Admin JWT |
| `/api/technical-skills/` | GET | Optional `admin=true` | Skill array; hidden rows included when requested | Public; query flag itself is not authenticated |
| `/api/technical-skills/` | POST | Skill category fields | Created skill object | JWT (route code does not enforce admin role) |
| `/api/technical-skills/<skill_id>` | PUT, DELETE | Path ID; PUT skill fields | Updated object or message/error JSON | JWT (route code does not enforce admin role) |
| `/contact/` | POST | Name, email, subject, message, optional phone and preferred contact method | Message/error JSON | Public |
| `/contact/admin/messages` | GET | `page`, `page_size`, `search`, `status` | Paginated messages, status counts and current filter | Admin JWT |
| `/contact/admin/messages/<message_id>/toggle-read` | PUT | Path ID | Updated message/status JSON | Admin JWT |
| `/contact/admin/messages/mark-all-read` | PUT | None | Updated-count/message JSON | Admin JWT |
| `/contact/admin/messages/<message_id>` | DELETE | Path ID | Message/error JSON | Admin JWT |
| `/admin/dashboard` | GET | None | Counts for projects, blogs, certifications, messages and users | Admin JWT |
| `/admin/users` | GET | `page`, `page_size`, `search` | Paginated users | Admin JWT |
| `/admin/users/<user_id>/toggle-admin` | PUT | Path ID | `{message,user}` | Admin JWT |
| `/resume/`, `/resume/view` | GET | None | PDF response or redirect to configured external resume URL | Public |
| `/resume/upload` | POST | Multipart `file` (PDF, max 10 MiB) | `{url,filename,message}` | JWT |
| `/resume/delete/<filename>` | DELETE | Path filename | Message/error JSON | JWT |
| `/resume/debug` | GET | None | Diagnostic JSON | Public |
| `/upload/<upload_type>` | POST | Multipart `file`; profile/cover/project/certificate images or resume PDF (max 5 MiB) | `{url,filename,message}` | JWT |
| `/upload/delete/<filename>` | DELETE | Path filename | Message/error JSON | JWT |
| `/polyglot/stage` | POST | Multipart `file` | Polyglot staging result; preview URL rewritten to local proxy | JWT |
| `/polyglot/stage/<stage_id>/preview` | GET | Path ID; JWT in query or Authorization header | Proxied bytes and upstream headers | JWT |
| `/polyglot/confirm/<stage_id>` | POST | Path ID; optional `{provider}` | Upstream JSON/status | JWT |
| `/polyglot/stage/<stage_id>` | DELETE | Path ID | Upstream JSON/status | JWT |

The inventory includes development/debug/health surfaces because they are
registered by the current application. Static frontend-serving routes are not
part of the target REST API and should not be carried into the API-only service.
The TypeScript migration adds a separate `GET /api/health/database` operational
probe; it is not part of the legacy Flask contract.

### Data model and constraints

The SQLAlchemy model contains `users`, `contact_messages`, `projects`,
`blog_categories`, `tags`, `authors`, `blogs`, `certifications`, `about`,
`technical_skills`, `experiences`, and `comments`, plus the `blog_tags`
many-to-many table. Important constraints and relationships:

- `users.username`, `users.email`, `blog_categories.name`, and `tags.name` are
  unique.
- Blogs require a category, may reference an author, and relate to tags and
  comments. Comments reference a user and blog and may reference a parent
  comment.
- Multiple models store JSON arrays/objects; PostgreSQL uses JSONB for model
  JSON columns while SQLite uses JSON.
- Boolean, date, datetime, cascade, and identity behavior must be tested on
  SQLite, D1, and PostgreSQL rather than assumed to be interchangeable.

`db.create_all()` only creates missing tables; it is not a schema migration.
`init_db.py` drops all tables before recreation and must never be used against
an existing or production database.

## Environment and dependencies

Current configuration is read through `python-dotenv` and `config.py`.
Important settings include:

- Environment and app: `ENVIRONMENT`, `SECRET_KEY`, `DEBUG`, `LOG_LEVEL`,
  `LOG_FILE`, `THREADED`, `MAX_CONTENT_LENGTH`.
- Databases: `DATABASE_BACKEND`, `DATABASE_URL`, Cloudflare account/database
  IDs and API token (for the existing HTTP path only), `CLOUDFLARE_D1_TIMEOUT`,
  and SQLAlchemy pool settings.
- Auth/CORS: `JWT_SECRET`, `JWT_EXP_MINUTES`, `ADMIN_USERNAME`,
  `ADMIN_TOKEN`, `CORS_ORIGINS`, `FRONTEND_ORIGIN`, `FRONTEND_URL`.
- Uploads/health: `UPLOAD_FOLDER`, `RESUME_PATH`, `HEALTH_CHECK_DATABASE`,
  `HEALTH_CHECK_TIMEOUT`.
- Integrations: `GEMINI_API_KEY`, `GEMINI_MODEL`, `EMAIL_SERVICE_URL`,
  `EMAIL_SERVICE_API_KEY`, `POLYGLOT_URL`, `POLYGLOT_API_KEY`.
- Rate limit settings exist but are not currently wired into the Flask app.

Python-specific functionality needing TypeScript equivalents includes Flask
Blueprints/WSGI, Flask-CORS, Flask-SQLAlchemy/SQLAlchemy, Marshmallow,
Flasgger/OpenAPI, PyJWT, Werkzeug password hashing and secure filenames,
`requests`, LangChain/Gemini, Python filesystem uploads, and Flask-Limiter.
`DATABASE_BACKEND=SQLAlchemy` can remain a compatibility selector, but it
cannot mean that Python SQLAlchemy itself runs in TypeScript.

## Database provider and runtime compatibility plan

| Selected backend / environment | Planned implementation | Support boundary |
| --- | --- | --- |
| `cloudflare_d1` in Workers | Central provider using the native D1 binding, prepared statements, bound parameters, batch and D1-supported transaction behavior | Supported only inside the Workers execution context; no D1 REST calls or account API token |
| `cloudflare_d1` in local development/tests | Wrangler local D1 simulation with the same provider contract | Local binding/runtime tests required; live Cloudflare use is not assumed |
| `SQLAlchemy` + SQLite in local Node.js | TypeScript SQL provider backed by a Node-compatible SQLite driver | Local development/test only; a normal SQLite filesystem driver is not a Workers database |
| `SQLAlchemy` + PostgreSQL in local Node.js | TypeScript PostgreSQL driver using `DATABASE_URL` | Supported when a reachable PostgreSQL server and credentials are configured |
| `SQLAlchemy` + PostgreSQL in Workers | PostgreSQL driver through Cloudflare Hyperdrive binding | Requires Hyperdrive configuration; not equivalent to arbitrary direct TCP or unpooled Workers connections |
| `SQLAlchemy` + SQLite in Workers | Not supported as a conventional filesystem database | Use D1 (`cloudflare_d1`) in Workers or SQLite locally; do not silently emulate durable SQLite storage |

Proposed implementation uses one provider factory and repository/service
layers, with Drizzle as the TypeScript SQL toolkit, a native D1 driver, a
local SQLite driver, and PostgreSQL through a Workers-compatible driver plus
Hyperdrive where deployed. Route handlers and business services must not access
bindings or connection-specific APIs directly. Migrations need dialect-aware
SQL because JSON, identity, date and transaction semantics differ.

### Next.js Cloudflare runtime evaluation

- **OpenNext Cloudflare adapter:** uses actual Next.js build output, supports
  App Router Route Handlers, and documents `getCloudflareContext()` access to
  native bindings and local Wrangler simulation. It is the conservative choice
  for API-contract fidelity. Its documentation notes Windows support is not
  guaranteed; WSL or Linux CI is the safer deployment-build environment.
  [OpenNext Cloudflare docs](https://opennext.js.org/cloudflare) and
  [binding docs](https://opennext.js.org/cloudflare/bindings).
- **vinext:** Cloudflare currently recommends it as the default Next.js path,
  and it exposes Workers bindings through `cloudflare:workers`; however,
  Cloudflare's guide explicitly describes vinext as beta and recommends
  running `vinext check` and reviewing its compatibility dashboard before
  adopting it for an existing production application. That additional
  reimplementation risk is not justified for the first compatibility-focused
  migration. Re-evaluate after the API-only workload is ported and can pass
  its compatibility suite.
  [Cloudflare Next.js guide](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)
  and [vinext compatibility](https://vinext.dev/compatibility).

### Runtime limitations and decisions to validate

1. **Uploads:** Workers local disk is not durable. The implementation plan is
   an R2-backed storage adapter on Workers and a local filesystem adapter for
   Node development, preserving returned URL and deletion behavior. R2 bucket
   configuration and public/custom-domain serving need deployment configuration.
2. **Password hashes:** Existing users use Werkzeug hashes. Verify the actual
   algorithm/version and implement a compatible verifier before any user
   database cutover; do not reset or rewrite hashes in bulk.
3. **JWT continuity:** Keep the existing `JWT_SECRET`, HS256 algorithm,
   `sub`, `user_id`, `is_admin`, and expiry semantics so clients and existing
   tokens remain compatible. Never copy secret values into Wrangler files.
4. **CORS:** Use explicit frontend origins and allow Authorization, Content-Type,
   and required preflight methods. The contact wrapper includes credentials;
   credentialed CORS must use explicit origins, not `*`.
5. **Endpoint authorization:** Existing behavior is inconsistent: `admin=true`
   on experiences and technical skills reveals hidden rows without checking
   admin authorization; technical-skill write routes enforce JWT but not an
   admin role despite their API descriptions. The route migration will
   preserve these behaviors for parity as requested; any later authorization
   hardening should be a separately reviewed behavior change.
6. **Static file URLs:** UI consumers use `/static/uploads/...`; the object
   storage adapter must preserve compatible URLs or document an explicit
   frontend migration.
7. **PostgreSQL and D1:** PostgreSQL-on-Workers requires Hyperdrive and a
   compatible client. It is separate from local SQLite testing and from D1;
   each configuration needs runtime integration tests before being called
   supported.

## Frontend integration findings

The frontend repository remains separate and unchanged. Its current API client
uses `VITE_API_BASE_URL`; an empty base uses relative `/api/...` paths. Vite
proxies `/api` and `/static/uploads` to `API_PROXY_TARGET`, currently Flask on
port 5000. Types are local and not generated from the backend.

- Login stores `{access_token,user}` in `localStorage`; protected requests send
  `Authorization: Bearer ...`. Existing auth is not cookie-based.
- Main content routes are public. Admin content writes and dashboard pages use
  bearer-token helpers. Error handling clears auth and redirects on 401.
- Contact submission uses camelCase `preferredContactMethod`, while the admin
  response model expects snake_case `preferred_contact_method`.
- Password reset posts `{token,new_password}`. Uploads include resume PDF,
  image upload and Polyglot staging/preview/confirmation flows.
- AI blog conversion expects HTML/title/excerpt/reading-time fields.
- Some resume links use root-relative `/api/resume/...` directly rather than
  the shared API base helper; separate-origin deployment may require a frontend
  change or a same-origin proxy.
- No dedicated frontend test script was found. The frontend includes
  diagnostics that reference Flask/localhost:5000; they are not the API client.

Detailed URL/environment guidance is in
[`FRONTEND_INTEGRATION.md`](./FRONTEND_INTEGRATION.md).

## Staged implementation plan

1. Keep Flask and its local/Docker workflows intact.
2. Add a standalone TypeScript API application under `worker-api/` in this
   backend repository; do not modify or combine the UI repository.
3. Add provider contracts and implementations first: native D1 via Workers
   binding; local SQLite and PostgreSQL via `DATABASE_URL`; Hyperdrive for
   PostgreSQL in Workers.
4. Add dialect-aware migrations without touching the original SQLite database;
   include export/verification/rollback instructions before any cutover.
5. Port auth and shared response/error handling, then migrate route families
   while comparing response/status contracts against Flask.
6. Add R2/local upload providers and port Gemini, email and Polyglot
   integrations without exposing secrets.
7. Run provider-level and route-level contract tests for every supported
   runtime/provider combination.
8. Keep deployment and production cutover gated on explicit user approval.

## References inspected

- Backend: [`app.py`](./app.py), [`config.py`](./config.py),
  [`database.py`](./database.py), [`models.py`](./models.py),
  [`schemas.py`](./schemas.py), [`routes/`](./routes),
  [`utils/`](./utils), [`tests/`](./tests), [`cloudflare/`](./cloudflare).
- Frontend: `D:\Workspace\Dev47-UI` API client, Vite configuration, auth,
  portfolio/admin pages, uploads, README and environment example (read-only).
- Runtime documentation: OpenNext Cloudflare adapter/bindings, Cloudflare
  Next.js/vinext guide, and Cloudflare Hyperdrive documentation, linked above.
