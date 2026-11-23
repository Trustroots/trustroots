import { useEffect, useMemo, useRef } from 'react';
import { debounce } from '../../../core/client/utils/debounce';

type DebounceOptions = {
  maxWait?: number;
};

export default function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => unknown,
  wait: number,
  options: DebounceOptions = {},
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const debounced = useMemo(
    () =>
      debounce(
        (...args: Args) => void callbackRef.current(...args),
        wait,
        options.maxWait,
      ),
    [wait, options.maxWait],
  );

  useEffect(() => () => debounced.cancel(), [debounced]);

  return debounced;
}
