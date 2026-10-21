# Kanban Board

A three-column Kanban board (To Do, Doing, Done) built with React, TypeScript and Vite. Each card has a title and a Rick and Morty character, fetched from the public [Rick and Morty GraphQL API](https://rickandmortyapi.com/graphql). Cards can be dragged between columns and reordered within a column, with the mouse or the keyboard.

## Running the app

Requires Node 20.19+ or 22.12+ (Vite 8's minimum).

```sh
npm install
npm run dev      # start the dev server at http://localhost:5173
npm run build    # type-check and build for production
npm run lint     # run ESLint
```

### Using the board

1. Type a card title.
2. Pick a character from the dropdown. It's filled in when the page loads, so you don't need to search; searching by name is optional. **Add card** stays disabled until there's both a title and a character.
3. The new card goes to the bottom of **To Do**.
4. To move a card, drag it with the mouse. With the keyboard, Tab to a card, press Space to pick it up, use the arrow keys to move it, and press Space again to drop it. Moving a card into **Done** from another column fires confetti, unless the OS has reduced motion turned on.

## Project structure

```
src/
  services/services.ts     GraphQL query, raw API types, mappers, fetchCharacters
  hooks/getCharacters.ts   useCharacters hook, which exposes loading / success / error
  types/item.ts            Item, the card type shared by the board and the card components
  components/
    Kanban.tsx             board state (types + reducer), columns, drag-and-drop handling
    Card.tsx               a card's look: character avatar and title, no drag logic
    SortableCard.tsx       wraps Card with useSortable so it can be dragged on the board
    AddItemForm.tsx        title input, character search and picker; reports { title, character }
  utils/assertNever.ts     exhaustiveness helper for unions the app controls
```

## Decisions

### API data is mapped into app types at the boundary

`services.ts` keeps two sets of types. The `Raw*` types describe exactly what the API can send, and the Rick and Morty schema makes nearly every field nullable. The app types (`Character`, `CharactersPage`) are what the rest of the code uses. One small mapper per nesting level converts between them, so no component ever handles raw API data.

A field gets a default only where an honest one exists:

- **Missing `results` array:** treated as an empty list.
- **Null entries in `results`:** dropped, with a console warning.
- **Missing `name` or `image`:** kept as `null`. There's no truthful default, so the UI shows "Unknown character" or a placeholder initial instead.
- **Missing `id`:** filled with `crypto.randomUUID()` and logged, because cards need a stable key. This is the only field the mapper invents, which is why it logs it.
- **Missing `info.next`:** `null`, which truthfully means there's no next page.

HTTP errors and GraphQL `errors` arrays both throw, so the hook can show them.

The query sits in the same file as the raw types because its field list decides their shape. Adding a field means changing the query, raw type, mapper and app type together. With more queries, I'd move them to `.graphql` files and generate the raw types with GraphQL Code Generator, so they can't drift from the schema.

### The character picker has a default list; search is optional

Every card needs a character, but not everyone knows the show well enough to search for one by name. So the dropdown loads the API's first page of characters as soon as the form appears, with an empty search, which returns the first 20 of the API's 826 characters, led by Rick, Morty and the rest of the Smith family. Anyone can pick a character and add a card without typing anything. Search is there for people who want a particular character, and it filters the same dropdown.

### Fetch state is a discriminated union

`useCharacters` returns `{ status: 'loading' } | { status: 'success', data } | { status: 'error', error }` instead of separate `loading` / `data` / `error` values. Separate values can end up in states that make no sense, such as data and an error at the same time.

- **Resetting to loading:** when the search changes, the hook resets to `loading` during render rather than inside the effect. That's React's recommended pattern for updating state when a prop changes, and it avoids an extra render.
- **Stale responses:** each request gets an `AbortController` and a `cancelled` flag. Aborting stops the network request. The flag stops a late or aborted response from overwriting newer results or showing up as an error.

### Board state lives in a reducer, stored by ID

`BoardState` keeps cards in an `items` map keyed by ID, and each column holds only an ordered list of IDs. Moving a card then only reorders ID lists; the card's data is never copied. `boardReducer` is a pure function with two actions, `addItem` and `moveItem`. Its `default` case calls `assertNever`, so adding a new action without handling it is a compile error. That's safe here because only the app creates these actions; data that comes from outside goes through the mappers instead.

### Drag and drop uses dnd-kit, kept minimal

I tried the browser's native HTML drag and drop and switched to dnd-kit. The native API has no keyboard support and is unreliable on touch screens. dnd-kit's `KeyboardSensor` makes the board usable without a mouse.

The setup is deliberately small:

- one `DndContext` with `closestCorners` collision detection
- a `PointerSensor` and a `KeyboardSensor`
- one `SortableContext` per column, plus `useDroppable` on each column so empty columns accept drops
- a single `onDragEnd` handler
- a `DragOverlay`: a floating copy of the dragged card that follows the pointer or keyboard, while the original stays dimmed in place

`onDragEnd` works out the destination column and index from whatever the card was dropped on, then dispatches `moveItem`. The reducer removes the card before inserting it, so the same action handles both reordering within a column and moving between columns.

The overlay is needed because `useSortable` only moves a card while it's over something in its own column. Without the overlay, a card dragged over another column stayed in its original spot on screen, even though dnd-kit had already registered the new column. Keyboard users saw no response to an arrow press, pressed again, and overshot into the wrong column. `useDndContext` gives the overlay the active card, so no `onDragStart` handler is needed.

The tradeoff is that no `onDragOver` handler is used. While a card is dragged over another column, that column's cards don't move aside to make room; the card slots in on drop.

### Components only know what they need

**`Card` and `SortableCard`:** `Card` only displays a card, the character avatar plus the title, and imports nothing from dnd-kit. `SortableCard` wraps it, calls `useSortable`, and renders the `<li>` that carries the drag handlers and movement styles. The board renders `SortableCard`. `Card` can be reused anywhere a card should appear without being draggable, such as a detail view or the `DragOverlay` preview, which renders it. The hook stays in the wrapper because `useSortable` only works inside a `DndContext` and `SortableContext`.

**No image workaround needed.** `Card` has no drag-specific attributes. Pressing on a character image doesn't start the browser's own image drag, because dnd-kit's `PointerSensor` cancels the browser's `dragstart` while a press is active.

**`AddItemForm` reports values, not cards.** The form calls `onSubmit({ title, character })` with exactly the fields it collects, typed as its own `AddItemValues`. `Kanban` turns those values into an `Item` and generates its ID with `crypto.randomUUID()` where the card is stored. So the form doesn't depend on `Item` or on how IDs are made. If IDs later come from a backend, or cards gain fields such as `createdAt`, only the board changes. I didn't make the form generic, or type it as `Omit<Item, 'id'>`. Its fields are fixed, and `Omit<Item, 'id'>` would just tie it back to `Item`.

### Accessibility

- **Keyboard dragging:** supported through `KeyboardSensor`.
- **Images:** character images have alt text, and the placeholder avatar has an `aria-label`.
- **Confetti:** uses canvas-confetti's `disableForReducedMotion`, so it respects the user's reduced-motion setting.

## Known limitations and next steps

- **If the character API is down, no new cards can be added.** The failure is caught, not crashed on. HTTP errors, GraphQL errors and network failures all reach the hook's `error` state, and the form shows "Couldn't load characters" with the error message. But every card needs a character, so the dropdown and **Add card** stay disabled. Gaps:
  - **No retry button.** The only way to retry is to change the search text.
  - **Raw error messages.** The text shown is the browser's own message, for example "Failed to fetch", rather than something written for users.
  - **Broken images.** Cards already on the board keep working, since each one stores a copy of its character, but if the image server is down their pictures appear broken. There's no image fallback.

  Next steps: a retry button, friendlier messages, an `onError` fallback to the placeholder avatar, and possibly letting cards be created without a character when the API is unavailable.
- **No persistence.** The board resets on reload. Next step: localStorage, or a backend.
- **Search sends a request on every keystroke.** Results stay correct because stale responses are discarded, but a short debounce would cut requests.
- **Only the first page of characters is offered.** `nextPage` is already mapped, so "load more" or infinite scroll could build on it.
- **Touch dragging.** Cards don't set `touch-action: none`, so on touch screens the browser may scroll instead of starting a drag.
- **No live preview for moves between columns** (see above). Adding an `onDragOver` handler would fix it.
- **No tests yet.** `boardReducer` and the mappers are pure functions, so they're the first candidates for unit tests.
