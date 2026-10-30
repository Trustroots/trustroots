import { useCallback, useSyncExternalStore } from 'react';

export const matchesMediaQuery = (query: string) =>
  !!window.matchMedia?.(query).matches;

export default function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mediaQuery = window.matchMedia?.(query);
      mediaQuery?.addEventListener('change', onChange);
      return () => mediaQuery?.removeEventListener('change', onChange);
    },
    [query],
  );
  const getSnapshot = () => matchesMediaQuery(query);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
