import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useApiData } from '../src/use-api-data';

describe('useApiData', () => {
  it('aborts a superseded request and keeps the newest result', async () => {
    const signals: AbortSignal[] = [];
    const resolvers = new Map<number, (value: string) => void>();
    const load = vi.fn(
      (key: number, signal: AbortSignal) =>
        new Promise<string>((resolve, reject) => {
          signals.push(signal);
          resolvers.set(key, resolve);
          signal.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError'))
          );
        })
    );
    const { result, rerender, unmount } = renderHook(
      ({ key }) => useApiData((signal) => load(key, signal), [key]),
      { initialProps: { key: 1 } }
    );

    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    rerender({ key: 2 });
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    expect(signals[0]?.aborted).toBe(true);

    await act(async () => resolvers.get(2)?.('newest'));
    await waitFor(() => expect(result.current.data).toBe('newest'));
    expect(result.current.error).toBeNull();

    unmount();
    expect(signals[1]?.aborted).toBe(true);
  });
});
