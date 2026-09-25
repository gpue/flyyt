import FlyRow from "./FlyRow";
import type { FlyInstanceData } from "./useFlyLayout";
import type { StatusSnapshot } from "./useStatusSnapshot";

interface FlyListProps {
  flies: FlyInstanceData[];
  selectedFlyId: string | null;
  statusSnapshot: StatusSnapshot;
  onSelectFly: (id: string | null) => void;
}

export default function FlyList({ flies, selectedFlyId, statusSnapshot, onSelectFly }: FlyListProps) {
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 0" }} role="list">
      {flies.map((fly) => {
        const isSelected = fly.id === selectedFlyId;
        return (
          <FlyRow
            key={fly.id}
            fly={fly}
            isSelected={isSelected}
            live={statusSnapshot.get(fly.id)}
            onClick={() => onSelectFly(isSelected ? null : fly.id)}
          />
        );
      })}
    </div>
  );
}
