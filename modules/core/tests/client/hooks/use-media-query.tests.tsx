import React from 'react';
import { renderToString } from 'react-dom/server';
import { act, renderHook } from '@testing-library/react';
import useMediaQuery, {
  matchesMediaQuery,
} from '@/modules/core/client/hooks/use-media-query';

describe('useMediaQuery', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  function mockMatchMedia(initialMatch: boolean) {
    let matches = initialMatch;
    const events = new EventTarget();
    const addEventListener = jest.fn(events.addEventListener.bind(events));
    const removeEventListener = jest.fn(
      events.removeEventListener.bind(events),
    );
    const matchMedia = jest.fn((media: string) => ({
      get matches() {
        return matches;
      },
      media,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener,
      removeEventListener,
      dispatchEvent: events.dispatchEvent.bind(events),
    }));
    window.matchMedia = matchMedia;

    return {
      matchMedia,
      addEventListener,
      removeEventListener,
      change(nextMatch: boolean) {
        matches = nextMatch;
        events.dispatchEvent(new Event('change'));
      },
    };
  }

  it.each([true, false])(
    'tracks query changes and unsubscribes (initial match: %s)',
    initialMatch => {
      const media = mockMatchMedia(initialMatch);

      const { result, unmount } = renderHook(() =>
        useMediaQuery('(max-width: 767px)'),
      );
      expect(result.current).toBe(initialMatch);
      expect(media.matchMedia).toHaveBeenCalledWith('(max-width: 767px)');
      expect(media.addEventListener).toHaveBeenCalledTimes(1);

      act(() => media.change(!initialMatch));
      expect(result.current).toBe(!initialMatch);

      unmount();
      expect(media.removeEventListener).toHaveBeenCalledWith(
        'change',
        media.addEventListener.mock.calls[0][1],
      );
    },
  );

  it('resubscribes when the query changes', () => {
    const media = mockMatchMedia(false);

    const { rerender } = renderHook(({ query }) => useMediaQuery(query), {
      initialProps: { query: '(max-width: 767px)' },
    });
    rerender({ query: '(max-width: 480px)' });

    expect(media.matchMedia).toHaveBeenCalledWith('(max-width: 480px)');
    expect(media.removeEventListener).toHaveBeenCalledTimes(1);
    expect(media.addEventListener).toHaveBeenCalledTimes(2);
  });

  it('renders as not matching on the server', () => {
    mockMatchMedia(true);

    function Probe() {
      return <>{String(useMediaQuery('(max-width: 767px)'))}</>;
    }

    expect(renderToString(<Probe />)).toBe('false');
  });

  it('does not match without matchMedia support', () => {
    Reflect.deleteProperty(window, 'matchMedia');

    const { result } = renderHook(() => useMediaQuery('(max-width: 767px)'));

    expect(result.current).toBe(false);
    expect(matchesMediaQuery('(max-width: 767px)')).toBe(false);
  });

  it('reads the current match synchronously', () => {
    const media = mockMatchMedia(true);

    expect(matchesMediaQuery('(min-width: 768px)')).toBe(true);
    expect(media.matchMedia).toHaveBeenCalledWith('(min-width: 768px)');
  });
});
