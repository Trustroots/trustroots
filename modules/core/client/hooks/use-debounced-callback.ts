import { useEffect, useMemo, useRef } from 'react';

export default function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => unknown,
  wait: number,
  { maxWait }: { maxWait?: number } = {},
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const debounced = useMemo(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let maxTimer: ReturnType<typeof setTimeout> | undefined;
    let latestArgs: Args;
    const cancel = () => {
      clearTimeout(timer);
      clearTimeout(maxTimer);
      maxTimer = undefined;
    };
    const invoke = () => {
      cancel();
      callbackRef.current(...latestArgs);
    };
    return Object.assign(
      (...args: Args) => {
        latestArgs = args;
        clearTimeout(timer);
        timer = setTimeout(invoke, wait);
        if (maxWait !== undefined) maxTimer ??= setTimeout(invoke, maxWait);
      },
      { cancel },
    );
  }, [wait, maxWait]);

  useEffect(() => debounced.cancel, [debounced]);

  return debounced;
}
