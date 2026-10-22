import { useSyncExternalStore } from 'react';

const query = '(max-width: 767px)';

function subscribe(onChange: () => void) {
  const mediaQuery = window.matchMedia(query);
  mediaQuery.addEventListener('change', onChange);
  return () => mediaQuery.removeEventListener('change', onChange);
}

function getSnapshot() {
  return window.matchMedia(query).matches;
}

export function useExtraSmall() {
  return useSyncExternalStore(subscribe, getSnapshot);
}
