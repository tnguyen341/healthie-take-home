import { useReducer, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Character } from '../services/services'
import type { Item } from '../types/item'
import AddItemForm from './AddItemForm'
import { assertNever } from '../utils/assertNever'

type ColumnId = 'todo' | 'doing' | 'done'

const COLUMN_ORDER: ColumnId[] = ['todo', 'doing', 'done']

const COLUMN_TITLES: Record<ColumnId, string> = {
  todo: 'To Do',
  doing: 'Doing',
  done: 'Done',
}

type BoardState = {
  items: Record<string, Item>
  columns: Record<ColumnId, Item["id"][]>
}

type BoardAction =
  | { type: 'addItem', addedItem: Item }
  | { type: 'moveItem', movedItemId: Item['id'], destination: ColumnId, destinationIndex: number }


const initialState: BoardState = {
  items: {},
  columns: { todo: [], doing: [], done: [] },
}

function boardReducer(state: BoardState, action: BoardAction): BoardState {
  switch (action.type) {
    case 'addItem': {
    // 1. add the item to `items`
    // 2. put its id at the end of the `todo` column
    // return a NEW state object (don't change `state` directly)
        const addedItemId = action.addedItem.id
        const items = {...state.items, [addedItemId]: action.addedItem}
        const columns = {
            todo: [...state.columns.todo, addedItemId],
            doing: state.columns.doing,
            done: state.columns.done
        }

        return {...state, items, columns}
    }

    case 'moveItem': {
    // 1. find which column the item is currently in
    // 2. remove its id from that column
    // 3. insert its id into the destination column at destinationIndex
    // return a NEW state object
        const sourceColumn = COLUMN_ORDER.find(col =>
            state.columns[col].includes(action.movedItemId)
        )
        if(!sourceColumn) return state
        const filteredColumn = state.columns[sourceColumn].filter(id => id !== action.movedItemId)

        const destinationBase = sourceColumn === action.destination ? filteredColumn : state.columns[action.destination]
        const copiedDestinationColumn = [...destinationBase]
        copiedDestinationColumn.splice(action.destinationIndex, 0, action.movedItemId);

        return {
            ...state,
            columns: {...state.columns, [sourceColumn]: filteredColumn, [action.destination]: copiedDestinationColumn}
        }
    }

    default:
        return assertNever(action)
  }
}

function isColumnId(id: string): id is ColumnId {
  return (COLUMN_ORDER as string[]).includes(id)
}

// A droppable id is either a column (when hovering an empty area) or an item inside one
function findColumn(columns: BoardState['columns'], id: string): ColumnId | undefined {
  if (isColumnId(id)) return id
  return COLUMN_ORDER.find(col => columns[col].includes(id))
}

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
  return <img src={character.image} alt={label} className="h-12 w-12 shrink-0 rounded object-cover" />
}

function ItemCard({ item }: { item: Item }) {
  return (
    <div className="flex items-center gap-3 rounded-md bg-gray-700 p-2 text-white shadow">
      <CharacterAvatar character={item.character} />
      <div className="min-w-0">
        <p className="truncate font-medium">{item.title}</p>
        <p className="truncate text-xs text-gray-300">{item.character.name ?? 'Unknown character'}</p>
      </div>
    </div>
  )
}

function SortableItemCard({ item }: { item: Item }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`cursor-grab touch-none ${isDragging ? 'opacity-40' : ''}`}
      {...attributes}
      {...listeners}
    >
      <ItemCard item={item} />
    </li>
  )
}

function Column({ columnId, items }: { columnId: ColumnId, items: Item[] }) {
  const { setNodeRef } = useDroppable({ id: columnId })
  return (
    <section className="flex w-72 shrink-0 flex-col overflow-hidden rounded-md bg-gray-200">
      <h2 className="bg-blue-900 px-3 py-2 text-sm font-semibold uppercase tracking-wide text-white">
        {COLUMN_TITLES[columnId]} <span className="font-normal text-blue-200">{items.length}</span>
      </h2>
      <SortableContext items={items.map(item => item.id)} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className="flex min-h-32 flex-1 flex-col gap-2 p-2">
          {items.map(item => <SortableItemCard key={item.id} item={item} />)}
        </ul>
      </SortableContext>
    </section>
  )
}

export default function Kanban() {
  const [state, dispatch] = useReducer(boardReducer, initialState)
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id))
  }

  // Cross-column moves happen while dragging so the target column opens a slot for the card
  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return
    const draggedId = String(active.id)
    const overId = String(over.id)
    const from = findColumn(state.columns, draggedId)
    const to = findColumn(state.columns, overId)
    if (!from || !to || from === to) return

    const overIndex = state.columns[to].indexOf(overId)
    let destinationIndex = state.columns[to].length
    if (overIndex !== -1) {
      const translated = active.rect.current.translated
      const isBelowOverItem = translated != null && translated.top > over.rect.top + over.rect.height / 2
      destinationIndex = overIndex + (isBelowOverItem ? 1 : 0)
    }
    dispatch({ type: 'moveItem', movedItemId: draggedId, destination: to, destinationIndex })
  }

  // Same-column reorders settle on drop
  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    if (!over) return
    const draggedId = String(active.id)
    const overId = String(over.id)
    const from = findColumn(state.columns, draggedId)
    const to = findColumn(state.columns, overId)
    if (!from || from !== to) return

    const column = state.columns[to]
    const oldIndex = column.indexOf(draggedId)
    const newIndex = isColumnId(overId) ? column.length - 1 : column.indexOf(overId)
    if (oldIndex === newIndex) return
    dispatch({ type: 'moveItem', movedItemId: draggedId, destination: to, destinationIndex: newIndex })
  }

  const activeItem = activeId ? state.items[activeId] : undefined

  return (
    <div className="flex flex-col gap-6 p-6">
      <AddItemForm onAdd={addedItem => dispatch({ type: 'addItem', addedItem })} />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="flex gap-4 overflow-x-auto pb-2">
          {COLUMN_ORDER.map(columnId => (
            <Column
              key={columnId}
              columnId={columnId}
              items={state.columns[columnId].map(id => state.items[id])}
            />
          ))}
        </div>
        <DragOverlay>
          {activeItem ? <div className="w-68 cursor-grabbing"><ItemCard item={activeItem} /></div> : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
