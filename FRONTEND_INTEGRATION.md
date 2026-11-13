# Frontend Integration

This document describes how the separate React + Vite frontend connects to the
new standalone API. The frontend repository remains independent; this
migration does not move it into this repository or change its implementation.

## API origin

The UI reads `VITE_API_BASE_URL` at build time. An empty value sends relative
`/api/...` requests. During Vite development, `API_PROXY_TARGET` proxies
`/api` and `/static/uploads` to the backend.

For the new local Workers preview, set the frontend proxy target to the local
Wrangler URL (planned default `http://localhost:8787`) or set
`VITE_API_BASE_URL` to the deployed API origin. The current example points to
Flask on `http://localhost:5000`; do not change the frontend setting until the
new API has passed compatibility tests.

The API base must be an origin or a base ending in `/api`; the shared client
handles both without duplicating `/api`. Some resume links are currently
root-relative (`/api/resume/` and `/api/resume/view`), so separate-origin
deployments may need a same-origin proxy or a targeted frontend change.

## Authentication

The existing UI stores the returned `access_token` and user object in
`localStorage`, then sends `Authorization: Bearer <token>` on authenticated
requests. Preserve the existing token response and claims. Most API calls do
not use cookies. The contact request wrapper sets `credentials: "include"`,
so a separate-origin API must allow credentials with a specific frontend
origin rather than `Access-Control-Allow-Origin: *`.

The UI expects:

- Login: `POST /api/auth/login` with `{username,password}` and a response
  containing `{access_token,user,message}`.
- Registration: `POST /api/auth/register` with `{username,email,password}`.
- Password reset: `POST /api/auth/reset-password` with `{token,new_password}`.
- Profile: `GET/PUT /api/auth/profile`; password change:
  `PUT /api/auth/change-password`.

Authenticated calls attach the bearer token. A 401 clears local auth state and
redirects to login.

## API compatibility

The UI consumes public reads for about, certifications, technical skills,
experiences, projects, blogs/categories/tags, related posts, comments, and
resume endpoints. Admin screens consume user/message management, dashboard
counts, content CRUD, blog conversion, uploads, and Polyglot staging.

Preserve the route methods, payload keys, response shapes, and status codes
listed in [`MIGRATION_AUDIT.md`](./MIGRATION_AUDIT.md). In particular:

- Contact submission sends camelCase `preferredContactMethod`; admin messages
  are currently returned with snake_case `preferred_contact_method`.
- Blog conversion returns HTML, suggested title/excerpt and reading-time
  fields; editor workflows also depend on suggested quick links and tags.
- Upload consumers expect `{url,filename,message}` and use
  `/static/uploads/...` URLs.
- Polyglot staging returns `{success,data:{stageId,previewUrl,expiresAt},error}`;
  its preview URL is consumed by the editor and must remain authenticated.
- Resume upload and delete flows use the `/api/resume/...` endpoints.

The frontend declares local TypeScript interfaces and currently has no shared
generated API schema. A new OpenAPI document can be added without modifying
the frontend's local models.

## CORS

For separate-origin development/deployment:

- Allow the exact Vite/deployed frontend origin.
- Permit `GET`, `POST`, `PUT`, `DELETE`, and `OPTIONS`.
- Permit `Authorization` and `Content-Type` headers.
- Return `Access-Control-Allow-Credentials: true` only with an explicit allowed
  origin.
- Test browser preflight requests, not only direct API calls.

Same-origin reverse-proxy deployments can avoid browser CORS, but the proxy
must forward Authorization headers and `/static/uploads` requests.

## Frontend changes needed only if separate-origin deployment requires them

1. Set `VITE_API_BASE_URL` to the new API origin, or change the Vite/deployment
   proxy target to the new backend.
2. Route resume links through the shared API base helper, or provide a
   same-origin proxy for `/api/resume/...`.
3. Do not switch bearer authentication to cookies unless a separately approved
   auth migration also updates the frontend.
4. Update development diagnostics that currently assume Flask on
   `localhost:5000` if those pages need to report the new API status.

No frontend edits are part of the backend migration unless separately
authorized.
