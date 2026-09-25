"""SimulatedFly -- a VDA5050 robot, fly-shaped. Movement and the map
lifecycle mirror vda5050-sim's SimulatedAgv (agv.py) at reduced scope: plain
straight-line node-to-node order-following (`_step_towards`) and the exact
downloadMap/enableMap/deleteMap simplification vda5050-sim uses (track a
mapId/mapVersion/mapStatus lifecycle, never fetch real content) -- no zones,
no fault injection, no legacy protocol versions, no full action catalog (see
the implementation plan for what's deferred and why).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import UTC, datetime

from flyyt_backend.schemas import (
    Action,
    ActionState,
    ActionStatus,
    Edge,
    InstantActionsMessage,
    MapState,
    MobileRobotPosition,
    Node,
    OperatingMode,
    OrderMessage,
    PowerSupply,
    StateMessage,
    VisualizationMessage,
)

ACTION_DURATION_S = 1.0  # fixed WAITING->RUNNING->FINISHED timer, matches vda5050-sim's default


def _now_iso() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds")


@dataclass
class PendingAction:
    action: Action
    elapsed_s: float = 0.0
    status: ActionStatus = ActionStatus.WAITING


@dataclass
class FlyConfig:
    id: str  # serialNumber
    manufacturer: str = "flyyt"
    initial_x: float = 0.0
    initial_y: float = 0.0
    initial_theta: float = 0.0


@dataclass
class SimulatedFly:
    cfg: FlyConfig
    x: float = 0.0
    y: float = 0.0
    theta: float = 0.0
    speed_mm_s: float = 18.0
    angular_speed_rad_s: float = 2.5

    nodes: list[Node] = field(default_factory=list)
    edges: list[Edge] = field(default_factory=list)
    order_id: str = ""
    order_update_id: int = 0
    last_node_id: str = ""
    driving: bool = False
    operating_mode: OperatingMode = OperatingMode.AUTOMATIC

    _maps: dict[tuple[str, str], MapState] = field(default_factory=dict)
    _pending_actions: list[PendingAction] = field(default_factory=list)
    _header_id: int = 0

    def __post_init__(self) -> None:
        self.x, self.y, self.theta = self.cfg.initial_x, self.cfg.initial_y, self.cfg.initial_theta

    @property
    def manufacturer(self) -> str:
        return self.cfg.manufacturer

    @property
    def serial_number(self) -> str:
        return self.cfg.id

    def _next_header_id(self) -> int:
        self._header_id += 1
        return self._header_id

    # -- order handling ------------------------------------------------------

    def handle_order(self, order: OrderMessage) -> None:
        # New orderId always replaces the current graph; a matching orderId
        # with a higher orderUpdateId extends it (matches vda5050-sim's
        # accept rule at reduced scope -- no reject-on-stale-update tracking).
        if order.orderId != self.order_id or order.orderUpdateId >= self.order_update_id:
            self.order_id = order.orderId
            self.order_update_id = order.orderUpdateId
            self.nodes = list(order.nodes)
            self.edges = list(order.edges)

    def handle_instant_actions(self, msg: InstantActionsMessage) -> None:
        for action in msg.actions:
            if action.actionType in ("downloadMap", "enableMap", "deleteMap"):
                self._pending_actions.append(PendingAction(action=action))
            elif action.actionType == "startPause":
                self.operating_mode = OperatingMode.MANUAL
            elif action.actionType == "stopPause":
                self.operating_mode = OperatingMode.AUTOMATIC

    def set_manual_mode(self, manual: bool) -> None:
        """Called when the frontend reports the local joystick engaging/
        releasing this fly -- maps directly onto VDA5050's real
        operatingMode field (MANUAL while joysticked, AUTOMATIC while
        order-following), rather than inventing a flyyt-specific status."""
        self.operating_mode = OperatingMode.MANUAL if manual else OperatingMode.AUTOMATIC

    # -- map lifecycle (vda5050-sim's exact simplification) ------------------

    def _apply_download_map(self, action: Action) -> None:
        params = {p.key: p.value for p in action.actionParameters}
        map_id, map_version = str(params.get("mapId", "")), str(params.get("mapVersion", ""))
        self._maps[(map_id, map_version)] = MapState(mapId=map_id, mapVersion=map_version, mapStatus="DISABLED")

    def _apply_enable_map(self, action: Action) -> None:
        params = {p.key: p.value for p in action.actionParameters}
        map_id, map_version = str(params.get("mapId", "")), str(params.get("mapVersion", ""))
        if (map_id, map_version) not in self._maps:
            self._maps[(map_id, map_version)] = MapState(mapId=map_id, mapVersion=map_version, mapStatus="DISABLED")
        for (mid, mver), m in self._maps.items():
            if mid == map_id:
                m.mapStatus = "ENABLED" if mver == map_version else "DISABLED"

    def _apply_delete_map(self, action: Action) -> None:
        params = {p.key: p.value for p in action.actionParameters}
        key = (str(params.get("mapId", "")), str(params.get("mapVersion", "")))
        self._maps.pop(key, None)

    def _advance_pending_actions(self, dt: float) -> None:
        for pending in self._pending_actions:
            if pending.status == ActionStatus.FINISHED:
                continue
            pending.elapsed_s += dt
            if pending.status == ActionStatus.WAITING and pending.elapsed_s > 0:
                pending.status = ActionStatus.RUNNING
            if pending.elapsed_s >= ACTION_DURATION_S:
                pending.status = ActionStatus.FINISHED
                if pending.action.actionType == "downloadMap":
                    self._apply_download_map(pending.action)
                elif pending.action.actionType == "enableMap":
                    self._apply_enable_map(pending.action)
                elif pending.action.actionType == "deleteMap":
                    self._apply_delete_map(pending.action)
        # Trim old finished actions so this list doesn't grow without bound.
        self._pending_actions = [p for p in self._pending_actions if p.status != ActionStatus.FINISHED][-50:] + [
            p for p in self._pending_actions if p.status == ActionStatus.FINISHED
        ][-10:]

    # -- movement (straight-line node-to-node, mirrors vda5050-sim's
    # _step_towards at reduced scope: no pre-rotation, no corridors/zones) --

    def _current_node(self) -> Node | None:
        if not self.nodes:
            return None
        return min(self.nodes, key=lambda n: n.sequenceId)

    def _find_edge_by_seq(self, seq: int) -> Edge | None:
        return next((e for e in self.edges if e.sequenceId == seq), None)

    def _find_node_by_seq(self, seq: int) -> Node | None:
        return next((n for n in self.nodes if n.sequenceId == seq), None)

    def _step_towards(self, node: Node, dt: float, *, edge: Edge | None = None) -> bool:
        pos = node.nodePosition
        if pos is None:
            return True
        dx, dy = pos.x - self.x, pos.y - self.y
        dist = math.hypot(dx, dy)
        effective_speed = self.speed_mm_s
        if edge is not None and edge.maximumSpeed is not None:
            effective_speed = min(effective_speed, edge.maximumSpeed)

        step = effective_speed * dt
        if dist <= max(step, 1e-6):
            self.x, self.y = pos.x, pos.y
            if pos.theta is not None:
                self.theta = pos.theta
            return True

        self.theta = math.atan2(dy, dx)
        self.x += dx / dist * step
        self.y += dy / dist * step
        return False

    def tick(self, dt: float) -> None:
        self._advance_pending_actions(dt)

        if self.operating_mode != OperatingMode.AUTOMATIC:
            self.driving = False
            return

        current_node = self._current_node()
        if current_node is None:
            self.driving = False
            return

        edge = self._find_edge_by_seq(current_node.sequenceId + 1)
        if edge is None or not edge.released:
            self.driving = False
            if edge is None:
                self.last_node_id = current_node.nodeId
                self.nodes = [n for n in self.nodes if n.sequenceId != current_node.sequenceId]
            return

        next_node = self._find_node_by_seq(edge.sequenceId + 1)
        if next_node is None or not next_node.released:
            self.driving = False
            return

        self.driving = True
        arrived = self._step_towards(next_node, dt, edge=edge)
        if arrived:
            self.last_node_id = next_node.nodeId
            self.edges = [e for e in self.edges if e.sequenceId != edge.sequenceId]
            self.nodes = [n for n in self.nodes if n.sequenceId != current_node.sequenceId]
            self.driving = False

    # -- message builders -----------------------------------------------------

    def build_state_message(self) -> StateMessage:
        return StateMessage(
            headerId=self._next_header_id(),
            timestamp=_now_iso(),
            manufacturer=self.manufacturer,
            serialNumber=self.serial_number,
            orderId=self.order_id,
            orderUpdateId=self.order_update_id,
            lastNodeId=self.last_node_id,
            driving=self.driving,
            mobileRobotPosition=MobileRobotPosition(x=self.x, y=self.y, theta=self.theta),
            powerSupply=PowerSupply(stateOfCharge=100.0, charging=False),
            operatingMode=self.operating_mode,
            actionStates=[
                ActionState(actionId=p.action.actionId, actionStatus=p.status, actionType=p.action.actionType)
                for p in self._pending_actions
            ],
            maps=list(self._maps.values()),
        )

    def build_visualization_message(self, reference_state_header_id: int) -> VisualizationMessage:
        return VisualizationMessage(
            headerId=self._next_header_id(),
            timestamp=_now_iso(),
            manufacturer=self.manufacturer,
            serialNumber=self.serial_number,
            referenceStateHeaderId=reference_state_header_id,
            mobileRobotPosition=MobileRobotPosition(x=self.x, y=self.y, theta=self.theta),
        )
