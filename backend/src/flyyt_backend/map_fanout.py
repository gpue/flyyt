"""Fleet-wide map adoption: "if one fly gets a new map, all flies must use
the map." Real-world precedent for this is nova-nav's dispatch_vda5050_map
handler (fan out downloadMap+enableMap per robot when its map is edited) --
same pattern, reimplemented here self-contained, no external system involved.
"""

from __future__ import annotations

from datetime import UTC, datetime

from flyyt_backend.fleet import Fleet
from flyyt_backend.map_store import MapData
from flyyt_backend.schemas import Action, ActionParameter, InstantActionsMessage
from flyyt_backend.transport import NatsTransport


def _now_iso() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds")


async def broadcast_map(fleet: Fleet, transport: NatsTransport, map_data: MapData, download_link: str) -> None:
    """Publishes downloadMap then enableMap instantActions (the real VDA5050
    two-step sequence) to every fly in the fleet, so all of them pick up the
    new shared map exactly like vda5050-sim's own simulated robots do when
    a fleet manager sends the same two actions."""
    for runtime in fleet.runtimes.values():
        fly = runtime.fly
        actions = [
            Action(
                actionId=f"download-{map_data.mapId}-{map_data.mapVersion}",
                actionType="downloadMap",
                actionParameters=[
                    ActionParameter(key="mapId", value=map_data.mapId),
                    ActionParameter(key="mapVersion", value=map_data.mapVersion),
                    ActionParameter(key="mapDownloadLink", value=download_link),
                ],
            ),
            Action(
                actionId=f"enable-{map_data.mapId}-{map_data.mapVersion}",
                actionType="enableMap",
                actionParameters=[
                    ActionParameter(key="mapId", value=map_data.mapId),
                    ActionParameter(key="mapVersion", value=map_data.mapVersion),
                ],
            ),
        ]
        msg = InstantActionsMessage(
            headerId=0,
            timestamp=_now_iso(),
            manufacturer=fly.manufacturer,
            serialNumber=fly.serial_number,
            actions=actions,
        )
        # Publish over the transport only -- every fly is already subscribed
        # to its own instantActions subject (FlyRuntime.start()), so this
        # reaches it exactly the same way a real external fleet manager's
        # message would. Also calling fly.handle_instant_actions(msg) here
        # directly (an earlier version of this code did) double-applies
        # every action once the fly's own subscription delivers the same
        # message back to it -- confirmed live: actionStates showed each
        # downloadMap/enableMap pair twice.
        await transport.publish(fly.manufacturer, fly.serial_number, "instantActions", msg)
