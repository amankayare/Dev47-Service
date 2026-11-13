# Dev47 data migration runbook

## Status and safety boundary

This runbook documents the migration tooling and the remaining production
gates. The initial SQLite/D1 schema is tested against the Flask SQLAlchemy
model schema. A snapshot exporter, checksum manifest, SQL importer, generated
D1 import, and verification commands are implemented and tested with
disposable local fixtures. PostgreSQL runtime testing, rehearsal against an
actual source backup, production approval, and rollback rehearsal are still
required.

No source records have been exported or changed. Do not run these steps
against a production database. The Wrangler D1 ID is still a placeholder.
Remote D1 operations require a separately reviewed change and explicit
approval.

Database exports may contain personal data, password hashes, password-reset
tokens, and configuration information. Store backups in an encrypted,
access-controlled location outside the repository. Never attach, commit, or
send them to a third party.

## Phase 1: inventory and source snapshot

1. Identify the exact source backend, database name/ID, schema version, and
   environment. Confirm `.env` values locally without copying secrets into
   tickets, terminals, or this repository.
2. Record the source row count for every application table:
   `users`, `contact_messages`, `projects`, `blog_categories`, `tags`,
   `authors`, `blogs`, `blog_tags`, `certifications`, `about`,
   `technical_skills`, `experiences`, and `comments`.
3. Record foreign-key violations, uniqueness violations, and the source
   database's backup/snapshot identifier.
4. Take a consistent backup. Keep the original source unchanged and retain
   the backup until post-cutover acceptance is complete.

### SQLite source

Stop Flask writes first, or use SQLite's online backup API to take a
transactionally consistent copy while it is running. Example from PowerShell,
after setting the source and backup paths to the intended files:

```powershell
uv run python -c "import sqlite3,sys; source=sqlite3.connect(sys.argv[1]); target=sqlite3.connect(sys.argv[2]); source.backup(target); target.close(); source.close()" `
  "D:\path\to\source.sqlite" `
  "D:\secure-backups\dev47-source.sqlite"
```

Run all inspection and migration tests against the copy, never the original.
Create the destination directory for the snapshot outside the repository; the
export command rejects output paths inside the repository.

For a SQLite source backup:

```powershell
Set-Location worker-api
npm run db:export:sqlite -- --source "D:\secure-backups\dev47-source.sqlite" `
  --output "D:\secure-backups\dev47-snapshot"
```

### PostgreSQL backup

Use the PostgreSQL tools against the explicitly identified source and store a
custom-format dump outside the repository. For example, provide connection
values through the local shell's protected environment and run:

```powershell
pg_dump --format=custom --file="D:\secure-backups\dev47-source.dump" `
  --host="$env:PGHOST" --port="$env:PGPORT" --username="$env:PGUSER" `
  "$env:PGDATABASE"
```

Do not use a production connection string in a committed file or command
history. Restore test dumps only into a disposable local database.

### Cloudflare D1 source

First verify the database name and ID in the Cloudflare dashboard and review
the current Wrangler configuration. The Wrangler D1 ID in this repository is
a placeholder, so the remote command must not be run until it is replaced and
the operation is approved. A data-only export is read-only:

```powershell
npx wrangler d1 export dev-47-local --remote --no-schema `
  --output "D:\secure-backups\dev47-d1-data.sql"
```

Do not use `--skip-confirmation`. Keep the SQL export protected as described
above. Perform any experiments using a separately named disposable local D1
database, not the remote source. Convert the SQL export into the common
checksummed snapshot format:

```powershell
Set-Location worker-api
npm run db:export:d1 -- --source "D:\secure-backups\dev47-d1-data.sql" `
  --output "D:\secure-backups\dev47-snapshot"
```

The converter initializes an in-memory SQLite schema, applies the D1
data-only SQL export, checks SQLite integrity and foreign keys, then writes
the checksummed snapshot. It does not connect to Cloudflare or persist a
second copy of the imported data.

### PostgreSQL snapshot export

The PostgreSQL exporter reads through a repeatable-read, read-only transaction
and pages rows by primary key:

```powershell
Set-Location worker-api
$env:DATABASE_BACKEND = "SQLAlchemy"
# Set DATABASE_URL in worker-api/.env to the reviewed source snapshot.
npm run db:export:postgres -- --output "D:\secure-backups\dev47-snapshot"
```

Prefer a restored copy of the `pg_dump` backup as the export source. The
exporter does not update the database, but the connection identity and target
must still be verified before running it.

## Phase 2: schema and importer qualification

1. Apply the dialect-specific initial schema only to a new disposable target.
   Never run `db.create_all()`, `init_db.py`, or the TypeScript migration
   runner against the source database.
2. Keep the snapshot and any generated D1 SQL outside the repository. The
   snapshot contains password hashes and possibly password-reset tokens.
3. Use the SQL importer only with the explicit confirmation environment
   variable below. It verifies the snapshot, requires the target's initial
   migration record and matching columns, refuses populated targets, preserves
   primary keys/values, and rolls back failed SQLite/PostgreSQL imports.
4. For D1, generate an SQL import file; this does not connect to or modify
   D1:

   ```powershell
   npm run db:import:d1:generate -- --input "D:\secure-backups\dev47-snapshot" `
     --output "D:\secure-backups\dev47-d1-import.sql"
   ```

5. Test the generated SQL only against a disposable local D1 database:

   ```powershell
   npx wrangler d1 migrations apply <disposable-d1-name> --local `
     --persist-to "D:\secure-backups\disposable-wrangler-state"
   npx wrangler d1 execute <disposable-d1-name> --local `
     --persist-to "D:\secure-backups\disposable-wrangler-state" `
     --file "D:\secure-backups\dev47-d1-import.sql"
   ```

   Wrangler `d1 execute --file` submits the file as a D1 batch. Verify this
   behavior and the target name before each use. Never omit `--local` in a
   rehearsal.
6. Preserve an untouched copy of both the source snapshot and the imported
   target until verification and rollback rehearsal pass.

For an approved remote cutover only, first verify the target database ID and
confirm every application table is empty. Do not run this preflight against
the production target without explicit approval:

```powershell
npx wrangler d1 execute <approved-target-name> --remote --command `
  "SELECT 'users' AS table_name, COUNT(*) AS row_count FROM users UNION ALL SELECT 'contact_messages', COUNT(*) FROM contact_messages UNION ALL SELECT 'projects', COUNT(*) FROM projects UNION ALL SELECT 'blog_categories', COUNT(*) FROM blog_categories UNION ALL SELECT 'tags', COUNT(*) FROM tags UNION ALL SELECT 'authors', COUNT(*) FROM authors UNION ALL SELECT 'blogs', COUNT(*) FROM blogs UNION ALL SELECT 'blog_tags', COUNT(*) FROM blog_tags UNION ALL SELECT 'certifications', COUNT(*) FROM certifications UNION ALL SELECT 'about', COUNT(*) FROM about UNION ALL SELECT 'technical_skills', COUNT(*) FROM technical_skills UNION ALL SELECT 'experiences', COUNT(*) FROM experiences UNION ALL SELECT 'comments', COUNT(*) FROM comments"
```

Stop if any count is non-zero. Only then, with the approved target ID in the
reviewed Wrangler configuration, run the import with `--remote` and without
`--skip-confirmation` or `--yes`.
The D1 file import can make the database temporarily unavailable. Afterward,
export the target with Wrangler `d1 export --no-schema`, convert it with
`db:export:d1`, and compare it to the source snapshot. The target must not
accept application writes before this comparison passes.

### Import into a new SQLite or PostgreSQL target

Set `DATABASE_BACKEND=SQLAlchemy` and `DATABASE_URL` in `worker-api/.env` to
the new empty target. Apply the initial migration, then import with an
ephemeral confirmation variable:

```powershell
npm run db:migrate:sql
$env:DATABASE_MIGRATION_CONFIRM = "import"
npm run db:import:sql -- --input "D:\secure-backups\dev47-snapshot"
Remove-Item Env:DATABASE_MIGRATION_CONFIRM
npm run db:verify:sql -- --input "D:\secure-backups\dev47-snapshot"
```

The SQL importer refuses a non-empty or unversioned schema. It does not
overwrite or merge existing data. The PostgreSQL dialect is implemented but
still requires a local PostgreSQL integration test before production use.

## Phase 3: verification gates

Do not approve cutover until all of these are recorded and pass:

- Every expected table exists, and per-table source and target row counts
  match.
- Primary keys and relationship/association rows match; there are no
  orphaned foreign keys or duplicate values that violate unique constraints.
- Canonicalized row-level checksums match for all migrated columns. Exclude
  only explicitly documented dialect-generated values; never omit passwords,
  permissions, visibility flags, or relationship IDs.
- JSON fields parse and retain their shape; dates, booleans, nulls, text, and
  Unicode values compare correctly.
- Authentication tests confirm existing Werkzeug password hashes verify and
  existing JWTs remain valid under the intended secret/claims.
- API contract and representative frontend workflows pass against the
  migrated copy before any production route change.

For SQL targets, run `db:verify:sql` against the same snapshot. For D1, export
the target with Wrangler as a data-only SQL file, convert it using
`db:export:d1`, then run:

```powershell
npm run db:compare:snapshots -- --source "D:\secure-backups\dev47-snapshot" `
  --target "D:\secure-backups\dev47-target-snapshot"
```

## Phase 4: controlled cutover and rollback

1. Schedule a maintenance window and pause source writes. Take a final
   consistent source snapshot after writes stop; do not rely on an earlier
   rehearsal snapshot for the final delta.
2. Import and run the complete verification gates on the final target.
3. Switch traffic only after approval. Keep the old API and source database
   intact and read-only during the observation period.
4. If verification or service checks fail before new writes are accepted,
   route traffic back to Flask and its original source. Preserve failed
   target logs and data for diagnosis; do not attempt an in-place destructive
   repair.
5. If the new API has accepted writes, a simple traffic rollback can lose
   those writes. Stop writes and reconcile them with an explicitly designed
   reverse-sync/recovery process before switching back. Do not declare
   rollback complete until write consistency is verified.
6. Retain the source backup and target snapshot until the owner signs off on
   data integrity and application behavior.

## Current validation

`tests/test_worker_schema.py` compares the initial SQLite and D1 schema with
Flask SQLAlchemy model metadata in a temporary local database. The TypeScript
suite exercises SQLite snapshot export/import, full row checksums, type
normalization, malformed snapshots, populated-target refusal, transaction
rollback on foreign-key violations, D1 SQL generation and D1 SQL export
conversion. An isolated Wrangler D1 local database was also migrated,
imported, exported, and compared successfully. No configured app database or
remote D1 data was read or changed. PostgreSQL needs an equivalent
disposable-server integration test before its export/import path is called
production-ready.
