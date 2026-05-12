import { useEffect, useState, useCallback } from 'react';
import { fetchApi, ApiError } from '../services/api.js';

/**
 * Generic fetch hook keyed on `path`. Aborts on unmount / path change.
 * Returns { data, error, loading, refetch }.
 */
export function useFetch(path) {
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(path) });

  const run = useCallback(
    (signal) => {
      if (!path) {
        setState({ data: null, error: null, loading: false });
        return;
      }
      setState((s) => ({ ...s, loading: true, error: null }));
      fetchApi(path, { signal })
        .then((data) => {
          if (signal?.aborted) return;
          setState({ data, error: null, loading: false });
        })
        .catch((err) => {
          if (signal?.aborted) return;
          if (err?.name === 'CanceledError') return;
          const e = err instanceof ApiError ? err : new ApiError('Unexpected error', { cause: err });
          setState({ data: null, error: e, loading: false });
        });
    },
    [path]
  );

  useEffect(() => {
    const controller = new AbortController();
    run(controller.signal);
    return () => controller.abort();
  }, [run]);

  const refetch = useCallback(() => run(), [run]);
  return { ...state, refetch };
}
