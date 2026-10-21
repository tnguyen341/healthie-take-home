import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Item } from "../types/item";
import Card from "./Card";

export default function SortableCard({ item }: { item: Item }) {
  // Makes this card sortable; only works when rendered inside a DndContext and a SortableContext
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      // Dim the original while the overlay copy is being dragged
      className={`cursor-grab ${isDragging ? "opacity-40" : ""}`}
    >
      <Card item={item} />
    </li>
  );
}
