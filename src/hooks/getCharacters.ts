import { useEffect, useState } from "react";
import { fetchCharacters, type CharactersPage } from "../services/services";

export type FetchState<T> =
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error };

export function useCharacters(page = 1, name = ""): FetchState<CharactersPage> {
  const [state, setState] = useState<FetchState<CharactersPage>>({
    status: "loading",
  });
  const [prevPage, setPrevPage] = useState(page);
  const [prevName, setPrevName] = useState(name);

  // Reset during render when params change, so the effect never sets 'loading' itself
  if (page !== prevPage || name !== prevName) {
    setPrevPage(page);
    setPrevName(name);
    setState({ status: "loading" });
  }

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    fetchCharacters(page, name, controller.signal)
      .then((data) => {
        if (!cancelled) setState({ status: "success", data });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          status: "error",
          error: err instanceof Error ? err : new Error(String(err)),
        });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [page, name]);

  return state;
}
