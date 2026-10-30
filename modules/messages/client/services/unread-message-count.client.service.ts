import createSubscribable from '@/modules/core/client/utils/subscribable';
import { unreadCount } from '@/modules/messages/client/api/messages.api';
import { watch as watchVisibility } from '@/modules/messages/client/services/visibility.client.service';

const ONE_SECOND = 1000;
const ONE_MINUTE = 60 * ONE_SECOND;
const FOREGROUND_POLLING_INTERVAL = 30 * ONE_SECOND;
const BACKGROUND_POLLING_INTERVAL = 5 * ONE_MINUTE;

let count: number | null = null;
let unwatchVisibility: (() => void) | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
const { subscribe, notify } = createSubscribable<number>();

/** Subscribe to updates to the unread message count. */
export function watch(fn: (count: number) => void): () => void {
  if (count !== null) fn(count);
  return subscribe(fn);
}

/** Starts polling and returns a function that stops it. */
export function start(): () => void {
  if (unwatchVisibility) unwatchVisibility();
  unwatchVisibility = watchVisibility(visible => {
    if (visible) {
      update();
      setPollingInterval(FOREGROUND_POLLING_INTERVAL);
    } else {
      setPollingInterval(BACKGROUND_POLLING_INTERVAL);
    }
  });
  return stop;
}

function stop(): void {
  if (timer) clearInterval(timer);
  if (unwatchVisibility) unwatchVisibility();
  timer = null;
  unwatchVisibility = null;
}

function setPollingInterval(interval: number): void {
  if (timer) clearInterval(timer);
  timer = setInterval(update, interval);
}

/** Polling and the inbox and thread pages call this only for a public member. */
export async function update(): Promise<void> {
  const newCount = await unreadCount();
  if (newCount === count) return;
  count = newCount;
  notify(count);
}
