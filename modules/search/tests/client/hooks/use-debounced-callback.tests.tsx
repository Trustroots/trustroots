import { act, renderHook } from '@testing-library/react';

import useDebouncedCallback from '@/modules/search/client/hooks/use-debounced-callback';

describe('useDebouncedCallback', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('keeps a stable callback and invokes the latest callback after the delay', () => {
    const first = vi.fn();
    const latest = vi.fn();
    const { result, rerender } = renderHook(
      ({ callback }) => useDebouncedCallback(callback, 300),
      { initialProps: { callback: first } },
    );
    const stableCallback = result.current;

    act(() => result.current('old'));
    rerender({ callback: latest });
    expect(result.current).toBe(stableCallback);

    act(() => vi.advanceTimersByTime(299));
    expect(first).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(latest).toHaveBeenCalledWith('old');
    expect(first).not.toHaveBeenCalled();
  });

  it('invokes a continuously called callback by maxWait', () => {
    const callback = vi.fn();
    const { result } = renderHook(() =>
      useDebouncedCallback(callback, 50, { maxWait: 100 }),
    );

    act(() => {
      result.current('a');
      vi.advanceTimersByTime(40);
      result.current('b');
      vi.advanceTimersByTime(40);
      result.current('c');
      vi.advanceTimersByTime(20);
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('c');
  });

  it('cancels pending work on unmount', () => {
    const callback = vi.fn();
    const { result, unmount } = renderHook(() =>
      useDebouncedCallback(callback, 20),
    );

    act(() => result.current('pending'));
    unmount();
    act(() => vi.runOnlyPendingTimers());

    expect(callback).not.toHaveBeenCalled();
  });
});
