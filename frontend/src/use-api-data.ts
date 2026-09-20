import { useCallback, useEffect, useRef, useState } from 'react';

export function useApiData<T>(
  load: (signal: AbortSignal) => Promise<T>,
  dependencies: unknown[]
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const requestSequence = useRef(0);
  const controller = useRef<AbortController | null>(null);

  const execute = useCallback(async (showLoading: boolean) => {
    const requestId = ++requestSequence.current;
    controller.current?.abort();
    const requestController = new AbortController();
    controller.current = requestController;
    if (showLoading) {
      setLoading(true);
      setError(null);
    }
    try {
      const result = await load(requestController.signal);
      if (requestId !== requestSequence.current) return;
      setData(result);
      setError(null);
    } catch (reason) {
      if (requestId !== requestSequence.current) return;
      if (reason instanceof DOMException && reason.name === 'AbortError')
        return;
      setError(
        reason instanceof Error ? reason : new Error('Something went wrong')
      );
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
    // Dependencies are supplied by the caller just like useEffect dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
  }, dependencies);

  const reload = useCallback(() => execute(true), [execute]);
  const refresh = useCallback(() => execute(false), [execute]);

  useEffect(() => {
    void reload();
    return () => {
      requestSequence.current += 1;
      controller.current?.abort();
    };
  }, [reload]);

  return { data, error, loading, reload, refresh };
}
