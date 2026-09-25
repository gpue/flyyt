"""VDA5050 v3.0.0 message schemas -- trimmed subset of vda5050-sim's
schemas.py (same field names/enum values, verified there against the
official spec's JSON Schemas) covering only what this simulator's v1 scope
implements: order node/edge traversal, downloadMap/enableMap/deleteMap
instant actions, and the state/connection/visualization messages. Zones,
factsheets, legacy protocol versions, and the full ~28-actionType catalog
are out of scope for now (see the implementation plan) -- not modeled here
so there's nothing half-implemented to trip over.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class OperatingMode(StrEnum):
    AUTOMATIC = "AUTOMATIC"
    MANUAL = "MANUAL"


class ActionStatus(StrEnum):
    WAITING = "WAITING"
    RUNNING = "RUNNING"
    FINISHED = "FINISHED"
    FAILED = "FAILED"


class ConnectionState(StrEnum):
    ONLINE = "ONLINE"
    OFFLINE = "OFFLINE"
    CONNECTION_BROKEN = "CONNECTION_BROKEN"


class ActionParameter(BaseModel):
    key: str
    value: Any


class Action(BaseModel):
    actionId: str
    actionType: str
    blockingType: str = "NONE"
    actionParameters: list[ActionParameter] = Field(default_factory=list)


class NodePosition(BaseModel):
    x: float
    y: float
    mapId: str = "default"
    theta: float | None = None


class Node(BaseModel):
    nodeId: str
    sequenceId: int
    released: bool = True
    nodePosition: NodePosition | None = None
    actions: list[Action] = Field(default_factory=list)


class Edge(BaseModel):
    edgeId: str
    sequenceId: int
    released: bool = True
    maximumSpeed: float | None = None
    actions: list[Action] = Field(default_factory=list)


class OrderMessage(BaseModel):
    headerId: int
    timestamp: str
    version: str = "3.0.0"
    manufacturer: str
    serialNumber: str
    orderId: str
    orderUpdateId: int = 0
    nodes: list[Node] = Field(default_factory=list)
    edges: list[Edge] = Field(default_factory=list)


class InstantActionsMessage(BaseModel):
    headerId: int
    timestamp: str
    version: str = "3.0.0"
    manufacturer: str
    serialNumber: str
    actions: list[Action] = Field(default_factory=list)


class ConnectionMessage(BaseModel):
    headerId: int
    timestamp: str
    version: str = "3.0.0"
    manufacturer: str
    serialNumber: str
    connectionState: ConnectionState


class MobileRobotPosition(BaseModel):
    x: float = 0.0
    y: float = 0.0
    theta: float = 0.0
    mapId: str = "default"
    localized: bool = True


class PowerSupply(BaseModel):
    stateOfCharge: float = Field(default=100.0, ge=0, le=100)
    charging: bool = False


class ActionState(BaseModel):
    actionId: str
    actionStatus: ActionStatus
    actionType: str | None = None


class MapState(BaseModel):
    """Summary entry in `state.maps` -- set via downloadMap/enableMap/
    deleteMap, same simplification as vda5050-sim's own MapState: tracks the
    mapId/mapVersion/mapStatus lifecycle only, never fetches map content
    itself (that's a separate, additive REST endpoint -- see map_store.py)."""

    mapId: str
    mapVersion: str
    mapStatus: str = "DISABLED"  # ENABLED or DISABLED


class StateMessage(BaseModel):
    headerId: int
    timestamp: str
    version: str = "3.0.0"
    manufacturer: str
    serialNumber: str
    orderId: str = ""
    orderUpdateId: int = 0
    lastNodeId: str = ""
    driving: bool = False
    mobileRobotPosition: MobileRobotPosition | None = None
    powerSupply: PowerSupply = Field(default_factory=PowerSupply)
    operatingMode: OperatingMode = OperatingMode.AUTOMATIC
    actionStates: list[ActionState] = Field(default_factory=list)
    maps: list[MapState] = Field(default_factory=list)


class VisualizationMessage(BaseModel):
    headerId: int
    timestamp: str
    version: str = "3.0.0"
    manufacturer: str
    serialNumber: str
    referenceStateHeaderId: int
    mobileRobotPosition: MobileRobotPosition | None = None
