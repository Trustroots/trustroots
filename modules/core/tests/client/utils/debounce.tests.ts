import { debounce } from '@/modules/core/client/utils/debounce';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls once with the latest arguments after the wait', () => {
    const callback = vi.fn();
    const debounced = debounce(callback, 100);

    debounced('a');
    vi.advanceTimersByTime(60);
    debounced('b');
    vi.advanceTimersByTime(99);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledExactlyOnceWith('b');
  });

  it('calls after maxWait when calls keep arriving', () => {
    const callback = vi.fn();
    const debounced = debounce(callback, 100, 250);

    for (let elapsed = 0; elapsed < 250; elapsed += 50) {
      debounced(elapsed);
      vi.advanceTimersByTime(50);
    }

    expect(callback).toHaveBeenCalledExactlyOnceWith(200);

    vi.advanceTimersByTime(1000);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('starts a new burst after a call', () => {
    const callback = vi.fn();
    const debounced = debounce(callback, 100, 250);

    debounced(1);
    vi.advanceTimersByTime(100);
    debounced(2);
    vi.advanceTimersByTime(100);

    expect(callback.mock.calls).toEqual([[1], [2]]);
  });

  it('drops the pending call on cancel', () => {
    const callback = vi.fn();
    const debounced = debounce(callback, 100, 250);

    debounced();
    debounced.cancel();
    vi.advanceTimersByTime(1000);

    expect(callback).not.toHaveBeenCalled();
  });
});
