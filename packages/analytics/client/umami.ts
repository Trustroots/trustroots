/**
 * The default tracker: hands events to the Umami tracker script that the page
 * layout loads. The script applies Do-Not-Track, the `umami.disabled` opt-out
 * and the configured website itself, so this adapter only hands events over.
 *
 * Besides `outreach-source.ts`, which keeps one value in `sessionStorage`,
 * this is the only module in the package that reads `window`.
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
 * Queue events until the tracker script finishes loading. A tracker without
 * a separate script lifecycle uses the page load event instead.
 */
export function createUmamiTracker(
  scriptSettled?: Promise<void>,
): AnalyticsTracker {
  let queue: QueuedEvent[] = [];
  let waitingForLoad = false;
  let waitingForScript = Boolean(scriptSettled);

  function flush(): void {
    waitingForLoad = false;
    waitingForScript = false;
    const pending = queue;
    queue = [];
    const tracker = currentTracker();
    if (tracker) pending.forEach(event => send(tracker, event));
  }

  void scriptSettled?.then(flush, flush);

  return {
    track(name, ...[data]) {
      const event: QueuedEvent = data === undefined ? [name] : [name, data];
      const tracker = waitingForScript ? undefined : currentTracker();
      if (tracker) {
        send(tracker, event);
        return;
      }
      if (
        !waitingForScript &&
        (scriptSettled || document.readyState === 'complete')
      ) {
        return;
      }
      if (queue.length < MAX_QUEUED_EVENTS) queue.push(event);
      if (!scriptSettled && !waitingForLoad) {
        waitingForLoad = true;
        window.addEventListener('load', flush, { once: true });
      }
    },
  };
}
