# Dev47 Service

Backend service for the Dev47 portfolio platform. 

The active production API is built with TypeScript on Cloudflare Workers (Next.js App Router + OpenNext) with Cloudflare D1 database and Polyglot Storage integration. The legacy Flask/Python implementation is preserved under [`legacy/`](legacy/).

---

## Architecture & Project Structure

```text
Dev47-Service/
├── worker-api/            # Active Production Backend (Cloudflare Worker API)
│   ├── src/
│   │   ├── app/api/       # REST API endpoints (App Router routes)
│   │   │   ├── about/
│   │   │   ├── admin/
│   │   │   ├── auth/
│   │   │   ├── blog-categories/
│   │   │   ├── blogs/
│   │   │   ├── certifications/
│   │   │   ├── contact/
│   │   │   ├── experiences/
│   │   │   ├── health/
│   │   │   ├── polyglot/
│   │   │   ├── projects/
│   │   │   ├── resume/
│   │   │   ├── technical-skills/
│   │   │   └── upload/
│   │   ├── lib/           # Repositories, database providers, auth & storage
│   │   └── types/         # Cloudflare & D1 type definitions
│   ├── public/            # OpenAPI specification and static docs
│   ├── scripts/           # D1 / SQLite migration & validation utilities
│   ├── wrangler.jsonc     # Cloudflare Worker & D1 binding configuration
│   └── package.json       # Dependencies, test & build scripts
├── legacy/                # Preserved Python (Flask + SQLAlchemy) backend
│   ├── routes/            # Original Flask blueprint routes
│   ├── utils/             # Python services (JWT, Gemini AI, Email)
│   ├── tests/             # Pytest test suite
│   ├── Dockerfile         # Docker container configuration
│   └── pyproject.toml     # Python dependencies (uv)
├── .env.example           # Example environment configuration
└── README.md
```

---

## Active API: `worker-api` (Cloudflare Worker)

### Prerequisites
- Node.js 20+
- npm or pnpm
- Cloudflare Wrangler CLI (`npm install -g wrangler` or use `npx wrangler`)

### Local Development
```powershell
# Navigate to worker-api directory
cd worker-api

# Install dependencies
npm install

# Run unit and integration tests (Vitest)
npm test

# Run local development server
npm run dev
```

### Production Build & Deployment
```powershell
# Build OpenNext worker bundle
npm run build

# Deploy to Cloudflare Workers
npx wrangler deploy --config wrangler.jsonc
```

### Live Endpoints
- **API URL:** `https://api.amankayare.com`
- **Interactive Swagger UI:** `https://api.amankayare.com/apidocs`
- **OpenAPI Specification:** `https://api.amankayare.com/apispec_1.json`

---

## Legacy Python Service
The legacy Flask backend code is preserved in [`legacy/`](legacy/README.md).
To run or inspect the legacy backend:
```powershell
cd legacy
uv sync
uv run python app.py
```
