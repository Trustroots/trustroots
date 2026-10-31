import { useEffect, useRef } from 'react';
import { matchesMediaQuery } from './use-media-query';

export default function useDesktopAutofocus<T extends HTMLElement>(
  enabled = true,
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (
      enabled &&
      document.activeElement === document.body &&
      matchesMediaQuery(
        '(min-width: 768px) and (hover: hover) and (pointer: fine)',
      )
    ) {
      ref.current?.focus({ preventScroll: true });
    }
  }, [enabled]);

  return ref;
}
