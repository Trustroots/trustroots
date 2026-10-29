import { useEffect, useRef } from 'react';

export default function useDesktopAutofocus<T extends HTMLElement>(
  enabled = true,
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (
      enabled &&
      document.activeElement === document.body &&
      window.matchMedia?.(
        '(min-width: 768px) and (hover: hover) and (pointer: fine)',
      ).matches
    ) {
      ref.current?.focus({ preventScroll: true });
    }
  }, [enabled]);

  return ref;
}
