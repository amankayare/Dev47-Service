# Dev47 TypeScript Worker API

This is the standalone Next.js API migration project. It does not contain or
serve the separate React frontend, and it is not yet a replacement for Flask.
Health endpoints, database provider foundation, initial database schemas,
guarded data-migration tooling, and the complete authentication and authorization
route slice are implemented; remaining application routes, durable uploads,
and external integrations are not yet ported.

## Local setup

Install Node.js 20.9 or newer, then from this directory run:

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

The local Next.js server listens on `http://localhost:3000`:

- `GET /api/health` returns the shared API health contract.
- `GET /api/health/database` checks the selected provider and returns HTTP 503
  if the database is unavailable.

Use Wrangler preview to exercise the Cloudflare Worker runtime:

```powershell
npm run cf:preview
```

## Database providers

Select one provider globally with `DATABASE_BACKEND`:

| `DATABASE_BACKEND` | Configuration | Runtime |
| --- | --- | --- |
| `cloudflare_d1` | Native Worker binding named `DB` | Cloudflare Workers and local Wrangler simulation |
| `SQLAlchemy` | `DATABASE_URL=sqlite:///./dev47-local.sqlite` | Local Node.js only; `SQLAlchemy` is a compatibility selector, not the Python library |
| `SQLAlchemy` | `DATABASE_URL=postgresql://user:password@localhost:5432/database` | Local Node.js only |
| `SQLAlchemy` | `USE_HYPERDRIVE=true` and a `HYPERDRIVE` binding | Workers after Hyperdrive is configured in Wrangler |

`worker-api/.env` is for local settings and is ignored by Git. The safe
template is `.env.example`. The D1 binding and non-secret settings belong in
`wrangler.jsonc`; secrets belong in the local secrets file or deployment
secret manager.

Initial schema migrations now exist for D1, SQLite, and PostgreSQL. The
SQLite/D1 schema is tested against the Flask model metadata. Snapshot exports,
guarded SQL imports, generated D1 imports, SQL verification, and snapshot
comparison are implemented. They have been exercised with disposable fixtures
and local Wrangler D1 only; no real source records were migrated. Wrangler's
local D1 data is separate from Cloudflare-hosted `dev-47-local`. The Wrangler
D1 ID is still a placeholder; do not use remote D1 or deploy until the ID and
migration have been reviewed. PostgreSQL integration testing and a real
source-backup rehearsal remain. Follow the
[data migration runbook](../DATA_MIGRATION_RUNBOOK.md); it lists the
commands, safeguards, and remaining gates. The broader route-by-route status
and migration decisions are in the root
[migration audit](../MIGRATION_AUDIT.md).

For a new local Wrangler D1 database, apply the schema from this directory:

```powershell
npx wrangler d1 migrations apply dev-47-local --local
```

For a new local SQLite or PostgreSQL database, set `DATABASE_BACKEND=SQLAlchemy`
and the matching `DATABASE_URL` in `.env`, then explicitly confirm schema
creation:

```powershell
$env:DATABASE_MIGRATION_CONFIRM = "apply"
npm run db:migrate:sql
Remove-Item Env:DATABASE_MIGRATION_CONFIRM
```

The SQL migration runner records applied versions and runs transactionally.
It is for a new target schema; it is not an importer and should not be run
against an existing database without a reviewed migration plan.

Data snapshot and D1 import files contain application data. The tools refuse
to write snapshots/import files inside the repository. Keep them in an
encrypted, access-controlled location. See the runbook for exporting a
consistent SQLite, PostgreSQL, or D1 snapshot; importing into a new SQL
target; generating D1 import SQL; and verifying or comparing all table hashes.

## Checks

```powershell
npm test
npx tsc --noEmit
npm run build
npm run cf:build
```

The test suite covers native D1 behavior with a fake binding, SQLite,
PostgreSQL placeholder conversion, global provider selection, and the initial
SQLite schema. Wrangler preview has also been checked against its local D1
binding.

## Migration status

Flask remains the operating API and schema source of truth. Current TypeScript
implementation in `worker-api/` covers:

- **Health endpoints**: `GET /api/health` and `GET /api/health/database`.
- **Database foundation**: Shared `DatabaseProvider` interface supporting native D1
  (`CloudflareD1Provider`), local SQLite (`SqliteProvider`), and PostgreSQL (`PostgresProvider`).
- **Initial D1/SQLite/PostgreSQL schemas**: Validated against Flask SQLAlchemy model metadata.
- **Data-migration tooling**: Checksummed snapshots, guarded SQL import, generated D1
  import SQL, target verification, and snapshot comparison.
- **Authentication & Authorization** (`/api/auth/*`):
  - Endpoints: `POST /api/auth/token` (Basic Auth), `POST /api/auth/register`, `POST /api/auth/login`,
    `GET /api/auth/me`, `GET /api/auth/profile`, `PUT /api/auth/profile`,
    `PUT /api/auth/change-password`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`.
  - Compatible Werkzeug password hashing/verification (`scrypt:32768:8:1` and `pbkdf2:sha256/sha1`).
  - PyJWT-compatible HS256 JWT creation, verification, expiration handling, and route guards.
  - Email Microservice dispatch for password reset tokens.
- **Portfolio & Content Routes**:
  - Projects: `GET /api/projects`, `GET /api/projects/featured`, `GET /api/projects/admin`,
    `POST /api/projects`, `GET /api/projects/:id`, `PUT /api/projects/:id`, `DELETE /api/projects/:id`.
  - About: `GET /api/about`, `POST /api/about`, `PUT /api/about`, `DELETE /api/about`.
  - Certifications: `GET /api/certifications`, `POST /api/certifications`, `GET /api/certifications/:id`,
    `PUT /api/certifications/:id`, `DELETE /api/certifications/:id`.
  - Experiences: `GET /api/experiences`, `POST /api/experiences`, `GET /api/experiences/:id`,
    `PUT /api/experiences/:id`, `DELETE /api/experiences/:id`.
  - Technical Skills: `GET /api/technical-skills`, `POST /api/technical-skills`, `GET /api/technical-skills/:id`,
    `PUT /api/technical-skills/:id`, `DELETE /api/technical-skills/:id`.
  - Contact & Messages: `POST /api/contact`, `GET /api/contact/admin/messages`,
    `PUT /api/contact/admin/messages/mark-all-read`, `PUT /api/contact/admin/messages/:id/toggle-read`,
    `DELETE /api/contact/admin/messages/:id`.
  - Admin: `GET /api/admin/dashboard`, `GET /api/admin/users`, `PUT /api/admin/users/:id/toggle-admin`.
- **Blogs, Categories & Comments**:
  - Blog Categories: `GET /api/blog-categories`, `POST /api/blog-categories`,
    `PUT /api/blog-categories/:id`, `DELETE /api/blog-categories/:id` (reassigns to General category).
  - Comments: `GET /api/blogs/:id/comments` (hierarchical tree), `POST /api/blogs/:id/comments`,
    `PUT /api/comments/:id`, `DELETE /api/comments/:id` (recursive reply tree deletion).
  - Blogs: `GET /api/blogs`, `GET /api/blogs/test`, `GET /api/blogs/:id`, `GET /api/blogs/:id/related`,
    `GET /api/blogs/tags/popular`, `GET /api/blogs/tags/popular/simple`, `GET /api/blogs/admin`,
    `POST /api/blogs`, `PUT /api/blogs/:id`, `DELETE /api/blogs/:id`.
  - AI Blog Conversion: `POST /api/blogs/convert` (Gemini API integration with input validation and error mapping),
    `GET /api/blogs/convert/default-prompt`.
- **Durable Upload Storage & Files**:
  - Storage provider abstraction (`R2StorageProvider` for Cloudflare Workers via `env.UPLOADS`,
    `LocalStorageProvider` for Node.js local dev, and `MemoryStorageProvider` for tests).
  - Public static serving: `GET /static/uploads/:filename`.
  - Resume endpoints: `GET /api/resume`, `GET /api/resume/view`, `POST /api/resume/upload`,
    `DELETE /api/resume/delete/:filename`, `GET /api/resume/debug`.
  - Upload endpoints: `POST /api/upload/:upload_type` (profile, cover, project, certificate, resume),
    `DELETE /api/upload/delete/:filename`.
- **Polyglot Storage Integration**:
  - `POST /api/polyglot/stage` (proxies multipart file with previewUrl rewriting),
    `GET /api/polyglot/stage/:id/preview` (bearer or query jwt verification and streaming preview),
    `POST /api/polyglot/confirm/:id` (upstream promotion to github/gdrive),
    `DELETE /api/polyglot/stage/:id` (staged asset discard).

The following operational gates remain before production replacement:

1. Qualify PostgreSQL against a disposable server with real migrations.
2. Rehearse a consistent source backup, restore, and verify row-level checksums against D1.
3. Review and configure real Cloudflare D1 IDs, R2 bucket bindings, Hyperdrive, and deployment secrets in Wrangler.
4. Obtain explicit owner approval before connecting to remote D1, performing database migrations, or executing production traffic cutover.
No remote database has been modified and no production cutover has occurred.

## Handoff for another coding assistant

Start at the repository root and read these in order:

1. [`README.md`](../README.md) for development and overall migration status.
2. [`MIGRATION_AUDIT.md`](../MIGRATION_AUDIT.md) for route inventory,
   frontend expectations, and compatibility decisions.
3. [`FRONTEND_INTEGRATION.md`](../FRONTEND_INTEGRATION.md) for API usage and
   response expectations from the separate UI repository.
4. This README for Worker commands and implemented foundations.
5. [`DATA_MIGRATION_RUNBOOK.md`](../DATA_MIGRATION_RUNBOOK.md) before any
   snapshot/import or database operation.

Then inspect the worktree and existing `routes/`, `models.py`, `schemas.py`,
`utils/`, and `worker-api/src/` implementation. Continue with authentication
and one bounded route family at a time; update this section and the migration
audit when actual code changes land. Do not access remote D1, alter production
data, deploy, or cut over traffic without explicit owner approval.
