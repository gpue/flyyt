# flyyt frontend, packaged standalone for a Hugging Face Docker Space:
# practice-mode only (no backend/NATS reachable -> client-side local flies,
# see ../README.md's Architecture section and src/useFlyLayout.ts's fallback).
FROM node:22-slim AS build

WORKDIR /build
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

# nginx-unprivileged, not stock nginx: Hugging Face Spaces run containers as
# uid 1000, and this image is set up to run as non-root and listen on a high
# port out of the box (see https://huggingface.co/docs/hub/spaces-sdks-docker).
FROM nginxinc/nginx-unprivileged:alpine

COPY --from=build /build/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 7860
