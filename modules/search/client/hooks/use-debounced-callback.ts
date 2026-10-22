import { useEffect, useMemo, useRef } from 'react';
import debounce from 'lodash/debounce';

type DebounceOptions = {
  maxWait?: number;
};

export default function useDebouncedCallback<Args extends unknown[], Result>(
  callback: (...args: Args) => Result,
  wait: number,
  options: DebounceOptions = {},
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const debounced = useMemo(
    () =>
      debounce((...args: Args) => callbackRef.current(...args), wait, options),
    [wait, options.maxWait],
  );

  useEffect(() => () => debounced.cancel(), [debounced]);

  return debounced;
}
