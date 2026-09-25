"""NATS transport -- same subject scheme as vda5050-sim's NatsTransport
(`{prefix}.{manufacturer}.{serialNumber}.{topic}`, one shared connection for
the whole fleet), trimmed to only the topics this simulator's v1 scope
uses (order, instantActions, state, connection, visualization). MQTT is not
implemented here -- vda5050-sim already covers standalone-MQTT fleets;
flyyt's backend targets the same NATS-based Nova deployment path.
"""

from __future__ import annotations

import json
import logging
from collections.abc import Awaitable, Callable

from nats.aio.client import Client as NATS
from pydantic import BaseModel

from flyyt_backend.schemas import InstantActionsMessage, OrderMessage

logger = logging.getLogger("flyyt_backend.transport")


class NatsTransport:
    def __init__(self, nats_url: str, prefix: str) -> None:
        self._nats_url = nats_url
        self.prefix = prefix
        self._nc: NATS | None = None

    def subject(self, manufacturer: str, serial_number: str, message_type: str) -> str:
        return f"{self.prefix}.{manufacturer}.{serial_number}.{message_type}"

    async def connect(self) -> None:
        self._nc = NATS()
        await self._nc.connect(servers=[self._nats_url], max_reconnect_attempts=-1)

    async def close(self) -> None:
        if self._nc is not None:
            await self._nc.drain()

    async def publish(self, manufacturer: str, serial_number: str, message_type: str, model: BaseModel) -> None:
        assert self._nc is not None
        subject = self.subject(manufacturer, serial_number, message_type)
        payload = json.dumps(model.model_dump(mode="json", exclude_none=True)).encode("utf-8")
        await self._nc.publish(subject, payload)

    async def subscribe_order(
        self, manufacturer: str, serial_number: str, handler: Callable[[OrderMessage], Awaitable[None]]
    ) -> None:
        assert self._nc is not None
        subject = self.subject(manufacturer, serial_number, "order")

        async def _cb(msg) -> None:
            try:
                await handler(OrderMessage.model_validate_json(msg.data))
            except Exception:
                logger.exception("error handling order on %s", subject)

        await self._nc.subscribe(subject, cb=_cb)

    async def subscribe_instant_actions(
        self, manufacturer: str, serial_number: str, handler: Callable[[InstantActionsMessage], Awaitable[None]]
    ) -> None:
        assert self._nc is not None
        subject = self.subject(manufacturer, serial_number, "instantActions")

        async def _cb(msg) -> None:
            try:
                await handler(InstantActionsMessage.model_validate_json(msg.data))
            except Exception:
                logger.exception("error handling instantActions on %s", subject)

        await self._nc.subscribe(subject, cb=_cb)
