import { act, renderHook } from '@testing-library/react';
import { useExtraSmall } from '@/modules/messages/client/utils/use-extra-small';

describe('useExtraSmall', () => {
  it.each([true, false])(
    'tracks breakpoint changes and unsubscribes (initial match: %s)',
    initialMatch => {
      let matches = initialMatch;
      const events = new EventTarget();
      const addEventListener = jest.fn(events.addEventListener.bind(events));
      const removeEventListener = jest.fn(
        events.removeEventListener.bind(events),
      );
      const originalMatchMedia = window.matchMedia;
      const matchMedia = jest.fn(() => ({
        get matches() {
          return matches;
        },
        media: '(max-width: 767px)',
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener,
        removeEventListener,
        dispatchEvent: events.dispatchEvent.bind(events),
      }));
      window.matchMedia = matchMedia;

      try {
        const { result, unmount } = renderHook(() => useExtraSmall());
        expect(result.current).toBe(initialMatch);
        expect(matchMedia).toHaveBeenCalledWith('(max-width: 767px)');
        expect(addEventListener).toHaveBeenCalledTimes(1);

        act(() => {
          matches = !initialMatch;
          events.dispatchEvent(new Event('change'));
        });
        expect(result.current).toBe(!initialMatch);

        unmount();
        expect(removeEventListener).toHaveBeenCalledWith(
          'change',
          addEventListener.mock.calls[0][1],
        );
      } finally {
        window.matchMedia = originalMatchMedia;
      }
    },
  );
});
