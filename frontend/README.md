---
title: flyyt
emoji: 🪰
colorFrom: purple
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

Practice-mode-only build: a fully client-side 3D fly-swarm playground (brain/
vision/wing/gait/audio, no backend or NATS involved). For the VDA5050
fleet-driving backend and full architecture, see the main repo:
https://github.com/gpue/flyyt

# flyyt frontend

Standalone browser 3D viewer: one fly, centered, with orbit controls. First
piece of the architecture described in `../context.md` §10 — the body side,
static for now, no FlyGym physics or connectome brain wired up yet.

## Run

```bash
npm install
npm run dev
```

## Stack

Vite + React 19 + TypeScript, `@react-three/fiber` + `@react-three/drei` for
the Three.js scene (`src/FlyScene.tsx`), same conventions as
`robot-ml/hand-replay/frontend`.

## Fly model

`public/models/fly.glb` is a static bake of the NeuroMechFly v2 body from
[`flygym`](https://github.com/NeLy-EPFL/flygym) (Apache-2.0 — see
`../CREDITS.md`), produced by `../tools/export_fly_mesh.py`. It's the same
biomechanical model FlyGym uses for physics, in its default "neutral" rest
pose (compiled standalone, no ground contact/standing solve). Regenerate it
after changing the pose/skeleton config:

```bash
cd ../tools
uv run python export_fly_mesh.py
```
