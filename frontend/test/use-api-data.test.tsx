import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useApiData } from '../src/use-api-data';

describe('useApiData', () => {
  it('keeps existing data visible during a background refresh', async () => {
    let resolveRefresh: (value: string) => void = () => {};
    const load = vi
      .fn<(signal: AbortSignal) => Promise<string>>()
      .mockResolvedValueOnce('initial')
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            resolveRefresh = resolve;
          })
      );
    const { result } = renderHook(() => useApiData(load, []));

    await waitFor(() => expect(result.current.data).toBe('initial'));
    expect(result.current.loading).toBe(false);

    act(() => {
      void result.current.refresh();
    });
    expect(result.current.data).toBe('initial');
    expect(result.current.loading).toBe(false);

    await act(async () => resolveRefresh('updated'));
    await waitFor(() => expect(result.current.data).toBe('updated'));
  });

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
