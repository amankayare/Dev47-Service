# Legacy Python (Flask) Backend

This directory contains the original Python (Flask + SQLAlchemy) backend implementation preserved for historical reference and backward compatibility.

## Contents
- **Flask Application:** `app.py`, `config.py`, `database.py`, `models.py`, `schemas.py`
- **Blueprints / Routes:** `routes/`
- **Utilities & Services:** `utils/`
- **Pytest Suite:** `tests/`
- **Docker & Compose:** `Dockerfile`, `compose.yaml`, `.dockerignore`
- **Package Management:** `pyproject.toml`, `uv.lock`

## Active Production Service
The active, deployed production API has migrated to the Cloudflare Worker Next.js implementation located under `/worker-api` (deployed to `https://api.amankayare.com`). Please refer to the root `README.md` and `worker-api/README.md` for current development and deployment instructions.
