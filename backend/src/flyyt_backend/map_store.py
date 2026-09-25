"""The self-contained map content flyyt's backend serves itself -- separate
from (and additive to) the downloadMap/enableMap/deleteMap *lifecycle*
simulation in fly.py, which (like vda5050-sim) never fetches real content.
Real VDA5050 fleets point `mapDownloadLink` at an external asset store
(nova-assets, for Wandelbots' own Nova platform); flyyt has no such
dependency and doesn't need one -- it stands in for that role itself with a
minimal node/edge JSON format, entirely self-hosted, no external service of
any kind required to run this.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class MapNode(BaseModel):
    id: str
    x: float
    y: float


class MapEdge(BaseModel):
    id: str
    from_: str = Field(alias="from")
    to: str

    model_config = {"populate_by_name": True}


class MapData(BaseModel):
    mapId: str = "default"
    mapVersion: str = "1"
    nodes: list[MapNode] = Field(default_factory=list)
    edges: list[MapEdge] = Field(default_factory=list)


class MapStore:
    """Single current map, shared fleet-wide -- there's only ever one active
    map for the whole flyyt fleet (matches "if one fly gets a new map, all
    flies must use the map": there IS only one map to have)."""

    def __init__(self) -> None:
        self._current: MapData = MapData()

    def get(self) -> MapData:
        return self._current

    def set(self, data: MapData) -> MapData:
        self._current = data
        return self._current
