import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Character } from '../services/services'
import type { Item } from '../types/item'

function CharacterAvatar({ character }: { character: Character }) {
  const label = character.name ?? 'Unknown character'
  if (character.image == null) {
    return (
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-gray-500 text-lg font-semibold text-white"
        aria-label={label}
      >
        {character.name?.[0] ?? '?'}
      </div>
    )
  }
  return <img src={character.image} alt={label} draggable={false} className="h-12 w-12 shrink-0 rounded object-cover" />
}

export default function Card({ item }: { item: Item }) {
  // Makes this card sortable; only works when rendered inside a DndContext and a SortableContext
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className="flex cursor-grab items-center gap-3 rounded-md bg-gray-700 p-2 text-white shadow"
    >
      <CharacterAvatar character={item.character} />
      <div className="min-w-0">
        <p className="truncate font-medium">{item.title}</p>
        <p className="truncate text-xs text-gray-300">{item.character.name ?? 'Unknown character'}</p>
      </div>
    </li>
  )
}
