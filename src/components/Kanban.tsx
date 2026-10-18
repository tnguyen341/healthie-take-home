import { useReducer } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import confetti from 'canvas-confetti'
import type { Item } from '../types/item'
import AddItemForm from './AddItemForm'
import Card from './Card'
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

function Column({ columnId, items }: { columnId: ColumnId, items: Item[] }) {
  // Makes the column itself a drop target, so a card can land in it even when it has no cards
  const { setNodeRef } = useDroppable({ id: columnId })
  return (
    <section className="flex w-72 shrink-0 flex-col overflow-hidden rounded-md bg-gray-200">
      <h2 className="bg-blue-900 px-3 py-2 text-sm font-semibold uppercase tracking-wide text-white">
        {COLUMN_TITLES[columnId]} <span className="font-normal text-blue-200">{items.length}</span>
      </h2>
      {/* Tells dnd-kit the order of this column's cards so it can shift them vertically while one is dragged */}
      <SortableContext items={items.map(item => item.id)} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className="flex min-h-32 flex-1 flex-col gap-2 p-2">
          {items.map(item => <Card key={item.id} item={item} />)}
        </ul>
      </SortableContext>
    </section>
  )
}

export default function Kanban() {
  const [state, dispatch] = useReducer(boardReducer, initialState)

  // Input methods that can start a drag: pointer (mouse/touch/pen) and keyboard (Space to lift, arrows to move)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function columnContaining(id: Item['id']): ColumnId | undefined {
    return COLUMN_ORDER.find(col => state.columns[col].includes(id))
  }

  // Runs once when a card is dropped; `over` is the card or column under it, or null if dropped elsewhere
  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over) return
    const movedItemId = String(active.id)
    const overId = String(over.id)

    const destination = isColumnId(overId) ? overId : columnContaining(overId)
    if (!destination) return
    const destinationIndex = isColumnId(overId)
      ? state.columns[destination].length
      : state.columns[destination].indexOf(overId)
    const source = columnContaining(movedItemId)

    dispatch({ type: 'moveItem', movedItemId, destination, destinationIndex })

    if (destination === 'done' && source !== 'done') {
      confetti({ disableForReducedMotion: true })
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <AddItemForm onAdd={addedItem => dispatch({ type: 'addItem', addedItem })} />
      {/* Shares drag state across the board; closestCorners picks the drop target whose corners are nearest the dragged card */}
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {COLUMN_ORDER.map(columnId => (
            <Column
              key={columnId}
              columnId={columnId}
              items={state.columns[columnId].map(id => state.items[id])}
            />
          ))}
        </div>
      </DndContext>
    </div>
  )
}
