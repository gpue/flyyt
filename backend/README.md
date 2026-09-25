# flyyt-backend

A VDA5050 fly-fleet simulator — an alternative to
[vda5050-sim](https://github.com/gpue/vda5050-sim) for flyyt's fly-scale
"robots" instead of full-size AGVs. Same wire protocol (order/instantActions
in, state/connection/visualization out) and deploy shape, at millimeter
scale. Fully self-contained: no private registries, no private git
dependencies, no Wandelbots-internal services required to build or run this.

## Run locally

You need a NATS server with its websocket listener enabled (the browser
frontend connects over WebSocket; the backend uses plain NATS):

```bash
cat > nats.conf <<'EOF'
websocket {
  port: 8080
  no_tls: true
}
EOF
docker run -p 4222:4222 -p 8080:8080 -v "$PWD/nats.conf:/etc/nats/nats.conf" nats:latest -c /etc/nats/nats.conf
```

Then, in this directory:

```bash
uv sync
uv run uvicorn flyyt_backend.main:app --port 8000
```

And the frontend, pointed at this backend (from `../frontend`):

```bash
VITE_FLYYT_API_URL=http://localhost:8000 VITE_NATS_WS_URL=ws://localhost:8080 npm run dev
```

No backend running is a fully supported "local practice mode" too — the
frontend falls back to local random flies and joystick-only control if it
can't reach `/roster`.

## Sending an order / a map

Standard VDA5050 messages, published over NATS on
`vda5050.v3.flyyt.{serialNumber}.order` /
`vda5050.v3.flyyt.{serialNumber}.instantActions` (any NATS client, e.g.
`nats pub`, works — see the VDA5050 spec for message shapes, or
`src/flyyt_backend/schemas.py`).

The shared fleet map is a small self-hosted REST resource instead of a real
VDA5050 `mapDownloadLink` target (see `map_store.py` for why):

```bash
curl -X POST http://localhost:8000/map -H "Content-Type: application/json" -d '{
  "mapId": "demo", "mapVersion": "1",
  "nodes": [{"id":"n0","x":-40,"y":-40},{"id":"n1","x":40,"y":-40}],
  "edges": [{"id":"e0","from":"n0","to":"n1"}]
}'
```

Posting a new map fans `downloadMap`+`enableMap` out to every fly in the
fleet automatically.

## Docker

```bash
docker build -t flyyt -f ../Dockerfile ..
docker run -p 8000:8000 -e NATS_BROKER=nats://your-nats-host:4222 flyyt
```

Serves the built frontend and the API on the same port (`/`).

## Scope

v1: order-following movement (straight-line node-to-node), the
downloadMap/enableMap/deleteMap map lifecycle, connection/state/
visualization telemetry, NATS transport. Not implemented (see
[vda5050-sim](https://github.com/gpue/vda5050-sim) if you need these):
battery drain, fault injection, legacy VDA5050 protocol versions
(1.1.0/2.0.0/2.1.0), zones/traffic control, MQTT standalone mode.
