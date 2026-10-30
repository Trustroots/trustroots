/**
 * The default tracker: hands events to the Umami tracker script that the page
 * layout loads. The script applies Do-Not-Track, the `umami.disabled` opt-out
 * and the configured website itself, so this adapter only hands events over.
 *
 * This is the only module in the package that reads `window`.
 */
import type {
  AnalyticsEventArgs,
  AnalyticsEventData,
  AnalyticsEventName,
} from '../shared/events.ts';

/** Records product events from the typed catalogue. */
export type AnalyticsTracker = {
  track<Name extends AnalyticsEventName>(
    name: Name,
    ...data: AnalyticsEventArgs<Name>
  ): void;
};

/** The part of the Umami tracker script's API this package uses. */
export type UmamiTracker = {
  track(
    eventName: string,
    eventData?: AnalyticsEventData,
  ): Promise<unknown> | void;
};

declare global {
  interface Window {
    umami?: UmamiTracker;
  }
}

type QueuedEvent = [name: string, data?: AnalyticsEventData];

/** Events kept while the asynchronous tracker script is still loading. */
export const MAX_QUEUED_EVENTS = 20;

function currentTracker(): UmamiTracker | undefined {
  const tracker = window.umami;
  return typeof tracker?.track === 'function' ? tracker : undefined;
}

function send(tracker: UmamiTracker, [name, data]: QueuedEvent): void {
  try {
    // Analytics delivery must never break the feature that reports it.
    Promise.resolve(tracker.track(name, data)).catch(() => undefined);
  } catch {
    // The tracker threw synchronously; drop the event.
  }
}

/**
 * Create a tracker backed by the Umami script. Events sent before the script
 * has loaded are queued until the page `load` event; afterwards a missing
 * tracker means it is disabled, blocked or unavailable, and the event is
 * dropped.
 */
export function createUmamiTracker(): AnalyticsTracker {
  let queue: QueuedEvent[] = [];
  let waitingForLoad = false;

  function flush(): void {
    waitingForLoad = false;
    const pending = queue;
    queue = [];
    const tracker = currentTracker();
    if (tracker) pending.forEach(event => send(tracker, event));
  }

  return {
    track(name, ...[data]) {
      const event: QueuedEvent = data === undefined ? [name] : [name, data];
      const tracker = currentTracker();
      if (tracker) {
        send(tracker, event);
        return;
      }
      if (document.readyState === 'complete') return;
      if (queue.length < MAX_QUEUED_EVENTS) queue.push(event);
      if (!waitingForLoad) {
        waitingForLoad = true;
        window.addEventListener('load', flush, { once: true });
      }
    },
  };
}
