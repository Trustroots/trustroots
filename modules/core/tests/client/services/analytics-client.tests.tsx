import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import {
  AnalyticsProvider,
  MAX_QUEUED_EVENTS,
  createUmamiTracker,
  useAnalytics,
  type AnalyticsTracker,
} from '@trustroots/analytics/client';

type TrackMock = jest.Mock<
  Promise<unknown> | void,
  [eventName: string, eventData?: Record<string, string | number>]
>;

function setReadyState(state: DocumentReadyState) {
  Object.defineProperty(document, 'readyState', {
    configurable: true,
    get: () => state,
  });
}

const trackMock = (): TrackMock =>
  jest.fn<
    Promise<unknown> | void,
    [eventName: string, eventData?: Record<string, string | number>]
  >();

function installTracker(track: TrackMock = trackMock()): TrackMock {
  window.umami = { track };
  return track;
}

afterEach(() => {
  delete window.umami;
  setReadyState('complete');
});

describe('createUmamiTracker', () => {
  it('sends events with and without data through the Umami tracker', () => {
    const track = installTracker(
      trackMock().mockImplementation(() => Promise.resolve()),
    );
    const tracker = createUmamiTracker();

    tracker.track('inbox-load-more', { page: 2 });
    tracker.track('signin-success');

    expect(track).toHaveBeenNthCalledWith(1, 'inbox-load-more', { page: 2 });
    expect(track).toHaveBeenNthCalledWith(2, 'signin-success', undefined);
  });

  it('drops events once the page has loaded without a tracker', () => {
    setReadyState('complete');
    const tracker = createUmamiTracker();
    const addEventListener = jest.spyOn(window, 'addEventListener');

    tracker.track('signup-rules-open');
    window.dispatchEvent(new Event('load'));
    const track = installTracker();
    tracker.track('signin-failure');

    expect(addEventListener).not.toHaveBeenCalledWith(
      'load',
      expect.any(Function),
      expect.anything(),
    );
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('signin-failure', undefined);
    addEventListener.mockRestore();
  });

  it('queues events until the page load event and then flushes them', () => {
    setReadyState('loading');
    const tracker = createUmamiTracker();

    tracker.track('offer-delete', { type: 'host' });
    tracker.track('search-offer-not-found');
    const track = installTracker();
    window.dispatchEvent(new Event('load'));
    window.dispatchEvent(new Event('load'));

    expect(track.mock.calls).toEqual([
      ['offer-delete', { type: 'host' }],
      ['search-offer-not-found', undefined],
    ]);
  });

  it('caps the queue while the tracker is loading', () => {
    setReadyState('interactive');
    const tracker = createUmamiTracker();

    for (let page = 0; page < MAX_QUEUED_EVENTS + 5; page += 1) {
      tracker.track('inbox-load-more', { page });
    }
    const track = installTracker();
    window.dispatchEvent(new Event('load'));

    expect(track).toHaveBeenCalledTimes(MAX_QUEUED_EVENTS);
  });

  it('discards queued events when the tracker never loads', () => {
    setReadyState('loading');
    const tracker = createUmamiTracker();

    tracker.track('offer-delete', { type: 'meet' });
    window.dispatchEvent(new Event('load'));
    const track = installTracker();
    setReadyState('complete');
    tracker.track('offer-delete', { type: 'host' });

    expect(track.mock.calls).toEqual([['offer-delete', { type: 'host' }]]);
  });

  it('ignores a tracker without a track function', () => {
    setReadyState('complete');
    window.umami = {} as Window['umami'];
    const tracker = createUmamiTracker();

    expect(() => tracker.track('signin-success')).not.toThrow();
  });

  it('keeps tracker failures away from the caller', async () => {
    const rejected = Promise.reject(new Error('network'));
    const track = installTracker(
      trackMock()
        .mockReturnValueOnce(rejected)
        .mockImplementationOnce(() => {
          throw new Error('tracker bug');
        }),
    );
    const tracker = createUmamiTracker();

    expect(() => tracker.track('signin-success')).not.toThrow();
    expect(() => tracker.track('signin-failure')).not.toThrow();
    await expect(rejected.catch(() => 'handled')).resolves.toBe('handled');
    expect(track).toHaveBeenCalledTimes(2);
  });
});

function TrackButtons() {
  const { track } = useAnalytics();

  return (
    <>
      <button type="button" onClick={() => track('signin-success')}>
        Sign in
      </button>
      <button
        type="button"
        onClick={() => track('offer-delete', { type: 'meet' })}
      >
        Delete
      </button>
    </>
  );
}

describe('AnalyticsProvider', () => {
  it('hands events from useAnalytics to the tracker it is given', () => {
    const tracker = { track: jest.fn() };

    render(
      <AnalyticsProvider tracker={tracker}>
        <TrackButtons />
      </AnalyticsProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(tracker.track.mock.calls).toEqual([
      ['signin-success'],
      ['offer-delete', { type: 'meet' }],
    ]);
  });

  it('keeps the same tracker across rerenders', () => {
    const tracker: AnalyticsTracker = { track: jest.fn() };
    const seen: AnalyticsTracker[] = [];
    function Consumer() {
      seen.push(useAnalytics());
      return null;
    }

    const { rerender } = render(
      <AnalyticsProvider tracker={tracker}>
        <Consumer />
      </AnalyticsProvider>,
    );
    rerender(
      <AnalyticsProvider tracker={tracker}>
        <Consumer />
      </AnalyticsProvider>,
    );

    expect(seen).toEqual([tracker, tracker]);
  });

  it('sends to the Umami tracker by default', () => {
    const track = installTracker();

    render(
      <AnalyticsProvider>
        <TrackButtons />
      </AnalyticsProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(track).toHaveBeenCalledWith('offer-delete', { type: 'meet' });
  });

  it('throws when useAnalytics is used outside AnalyticsProvider', () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    expect(() => render(<TrackButtons />)).toThrow(
      'useAnalytics must be used within AnalyticsProvider',
    );

    consoleError.mockRestore();
  });
});
