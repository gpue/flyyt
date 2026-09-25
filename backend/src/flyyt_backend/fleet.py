"""Fleet -- owns one FlyRuntime per configured fly, same 4-loop-per-robot
shape as vda5050-sim's RobotRuntime/Fleet (movement/connection/state/
visualization), trimmed to NATS-only (see transport.py) and no zone/
responses subscriptions (out of v1 scope).
"""

from __future__ import annotations

import asyncio
import contextlib
import random
from dataclasses import dataclass

import yaml

from flyyt_backend.config import Settings
from flyyt_backend.fly import FlyConfig, SimulatedFly
from flyyt_backend.schemas import ConnectionMessage, ConnectionState
from flyyt_backend.transport import NatsTransport


@dataclass
class FleetLayoutConfig:
    count: int = 12
    area_width_mm: float = 120.0
    area_depth_mm: float = 120.0
    seed: int = 42


def load_fleet_layout(path: str) -> FleetLayoutConfig:
    try:
        with open(path) as f:
            raw = yaml.safe_load(f) or {}
    except FileNotFoundError:
        raw = {}
    return FleetLayoutConfig(**raw)


def build_fly_configs(layout: FleetLayoutConfig) -> list[FlyConfig]:
    # Deterministic (seeded) spawn positions, not vda5050-sim's hand-picked
    # per-robot-archetype roster -- flyyt's flies are all identical, so a
    # generated layout is the right analogue of that file, and a shared seed
    # is what lets the frontend and backend agree on layout without the
    # frontend needing to also do the random generation (it now fetches this
    # roster from GET /fleet instead -- see useFlyLayout.ts).
    rng = random.Random(layout.seed)
    configs = []
    for i in range(layout.count):
        configs.append(
            FlyConfig(
                id=f"fly-{i}",
                initial_x=(rng.random() - 0.5) * layout.area_width_mm,
                initial_y=(rng.random() - 0.5) * layout.area_depth_mm,
                initial_theta=rng.random() * 2 * 3.14159265,
            )
        )
    return configs


class FlyRuntime:
    def __init__(self, fly: SimulatedFly, transport: NatsTransport, settings: Settings) -> None:
        self.fly = fly
        self.transport = transport
        self.settings = settings
        self._tasks: list[asyncio.Task] = []
        self._last_state_header_id = 0
        self.online = False

    async def start(self) -> None:
        await self.transport.subscribe_order(self.fly.manufacturer, self.fly.serial_number, self._on_order)
        await self.transport.subscribe_instant_actions(
            self.fly.manufacturer, self.fly.serial_number, self._on_instant_actions
        )
        self._tasks = [
            asyncio.create_task(self._movement_loop()),
            asyncio.create_task(self._connection_loop()),
            asyncio.create_task(self._state_loop()),
            asyncio.create_task(self._visualization_loop()),
        ]

    async def stop(self) -> None:
        with contextlib.suppress(Exception):
            await self._publish("connection", self._connection_message(ConnectionState.OFFLINE))
        for t in self._tasks:
            t.cancel()

    async def _on_order(self, order) -> None:
        self.fly.handle_order(order)

    async def _on_instant_actions(self, msg) -> None:
        self.fly.handle_instant_actions(msg)

    async def _publish(self, message_type: str, model) -> None:
        await self.transport.publish(self.fly.manufacturer, self.fly.serial_number, message_type, model)

    def _connection_message(self, state: ConnectionState) -> ConnectionMessage:
        from flyyt_backend.fly import _now_iso

        return ConnectionMessage(
            headerId=0,
            timestamp=_now_iso(),
            manufacturer=self.fly.manufacturer,
            serialNumber=self.fly.serial_number,
            connectionState=state,
        )

    async def _movement_loop(self) -> None:
        tick_s = self.settings.tick_s
        while True:
            self.fly.tick(tick_s)
            await asyncio.sleep(tick_s)

    async def _connection_loop(self) -> None:
        self.online = True
        await self._publish("connection", self._connection_message(ConnectionState.ONLINE))
        while True:
            await asyncio.sleep(self.settings.connection_heartbeat_s)
            await self._publish("connection", self._connection_message(ConnectionState.ONLINE))

    async def _state_loop(self) -> None:
        interval = 1.0 / self.settings.state_hz
        while True:
            state = self.fly.build_state_message()
            self._last_state_header_id = state.headerId
            await self._publish("state", state)
            await asyncio.sleep(interval)

    async def _visualization_loop(self) -> None:
        interval = 1.0 / self.settings.visualization_hz
        while True:
            await self._publish("visualization", self.fly.build_visualization_message(self._last_state_header_id))
            await asyncio.sleep(interval)


class Fleet:
    def __init__(self, settings: Settings, transport: NatsTransport) -> None:
        self.settings = settings
        self.transport = transport
        self.runtimes: dict[str, FlyRuntime] = {}

    async def start(self, configs: list[FlyConfig]) -> None:
        for cfg in configs:
            fly = SimulatedFly(cfg=cfg, speed_mm_s=self.settings.default_speed_mm_s)
            runtime = FlyRuntime(fly, self.transport, self.settings)
            self.runtimes[cfg.id] = runtime
            await runtime.start()

    async def stop(self) -> None:
        for runtime in self.runtimes.values():
            await runtime.stop()

    def snapshot(self) -> list[dict]:
        out = []
        for runtime in self.runtimes.values():
            fly = runtime.fly
            out.append(
                {
                    "id": fly.serial_number,
                    "manufacturer": fly.manufacturer,
                    "online": runtime.online,
                    "driving": fly.driving,
                    "operatingMode": fly.operating_mode.value,
                    "batteryPercent": 100.0,
                    "x": fly.x,
                    "y": fly.y,
                    "theta": fly.theta,
                    "orderId": fly.order_id,
                }
            )
        return out

    def roster(self) -> list[dict]:
        return [
            {"id": r.fly.serial_number, "x": r.fly.x, "y": r.fly.y, "theta": r.fly.theta}
            for r in self.runtimes.values()
        ]
