import { useState, type SubmitEvent } from "react";
import type { Character, CharactersPage } from "../services/services";
import { useCharacters, type FetchState } from "../hooks/getCharacters";
import { assertNever } from "../utils/assertNever";

export type AddItemValues = { title: string; character: Character };

function characterStatusText(state: FetchState<CharactersPage>): string | null {
  switch (state.status) {
    case "loading":
      return "Loading characters…";
    case "error":
      return `Couldn't load characters: ${state.error.message}`;
    case "success":
      return state.data.characters.length === 0
        ? "No characters match that name"
        : null;
    default:
      return assertNever(state);
  }
}

export default function AddItemForm({
  onSubmit,
}: {
  onSubmit: (values: AddItemValues) => void;
}) {
  const [title, setTitle] = useState("");
  const [search, setSearch] = useState("");
  const [characterId, setCharacterId] = useState("");
  const charactersState = useCharacters(1, search);

  const characters =
    charactersState.status === "success" ? charactersState.data.characters : [];
  const selected = characters.find((c) => c.id === characterId) ?? null;
  const statusText = characterStatusText(charactersState);

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || !selected) return;
    //on submit handles only input values that the form actually collects
    onSubmit({ title: trimmed, character: selected });
    setTitle("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col text-sm text-gray-700">
        Title
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          className="rounded border border-gray-300 px-2 py-1"
        />
      </label>
      <label className="flex flex-col text-sm text-gray-700">
        Search characters
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="e.g. Rick"
          className="rounded border border-gray-300 px-2 py-1"
        />
      </label>
      <label className="flex flex-col text-sm text-gray-700">
        Character
        <select
          value={selected?.id ?? ""}
          onChange={(e) => setCharacterId(e.target.value)}
          disabled={characters.length === 0}
          className="w-56 rounded border border-gray-300 px-2 py-1"
        >
          <option value="" disabled>
            Select a character
          </option>
          {characters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name ?? "Unknown character"}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={!title.trim() || !selected}
        className="rounded bg-blue-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        Add card
      </button>
      {statusText && (
        <p className="w-full text-sm text-gray-500">{statusText}</p>
      )}
    </form>
  );
}
