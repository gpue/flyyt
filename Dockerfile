# flyyt: fly-swarm visualizer + VDA5050 fly-fleet simulator backend.
# Multi-stage build (Node build stage for the frontend, then a Python
# runtime stage serving both the built frontend and the API on one port) --
# same shape as this monorepo's other combined frontend+backend Nova apps.
# Fully self-contained: no private registries, no private git dependencies,
# no Wandelbots-internal services required to build or run this image.

# ---- Stage 1: Build frontend ----
FROM node:22-slim AS frontend-build

WORKDIR /build
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY frontend/ .
RUN npm run build

# ---- Stage 2: Python runtime ----
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    FRONTEND_DIST_PATH=/app/frontend/dist \
    PORT=8000

WORKDIR /app

RUN pip install --no-cache-dir uv

COPY backend/pyproject.toml backend/fleet.default.yaml ./
COPY backend/src/ src/
RUN uv pip install --system --no-cache .

COPY --from=frontend-build /build/dist frontend/dist/

EXPOSE 8000

CMD ["uvicorn", "flyyt_backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
