// Raw types mirror the Rick and Morty GraphQL schema, where nearly every field is nullable.
type RawCharacter = {
    id: string | null,
    name: string | null,
    image: string | null
}

type RawCharactersPage = {
    info: { next: number | null } | null,
    results: (RawCharacter | null)[] | null
}

type RawCharacterResponse = {
    data?: {
        characters: RawCharactersPage | null
    } | null,
    errors?: { message: string }[],
}

export type Character = {
    id: string,
    name: string | null,
    image: string | null
}

export type CharactersPage = {
    characters: Character[],
    nextPage: number | null
}

const CHARACTERS_QUERY = `
  query Characters($page: Int, $name: String) {
    characters(page: $page, filter: { name: $name }) {
      info { next }
      results { id name image }
    }
  }
`

function toAppCharacter(raw: RawCharacter): Character {
    if (raw.id == null) {
        console.warn('Character missing id; generated a client-side id', raw)
    }
    return {
        id: raw.id ?? crypto.randomUUID(),
        name: raw.name,
        image: raw.image,
    }
}

function toAppCharactersPage(raw: RawCharactersPage | null): CharactersPage {
    const results = raw?.results ?? []
    const characters = results.filter((c): c is RawCharacter => c != null)
    if (characters.length !== results.length) {
        console.warn(`Dropped ${results.length - characters.length} null character entries`)
    }
    return {
        characters: characters.map(toAppCharacter),
        nextPage: raw?.info?.next ?? null,
    }
}

export async function fetchCharacters(page = 1, name = '', signal?: AbortSignal): Promise<CharactersPage> {
  const res = await fetch('https://rickandmortyapi.com/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: CHARACTERS_QUERY, variables: { page, name } }),
    signal,
  })
  if (!res.ok) {
    throw new Error(`Characters request failed: ${res.status}`)
  }

  const raw: RawCharacterResponse = await res.json()
  if (raw.errors?.length) {
    throw new Error(raw.errors.map(e => e.message).join('; '))
  }

  return toAppCharactersPage(raw.data?.characters ?? null)
}
