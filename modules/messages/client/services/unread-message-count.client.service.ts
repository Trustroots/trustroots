import {
  onClientEvent,
  getCurrentUser,
} from '@/modules/core/client/services/client-runtime';
import createSubscribable from '@/modules/core/client/utils/subscribable';
import { unreadCount } from '@/modules/messages/client/api/messages.api';
import { watch as watchVisibility } from '@/modules/messages/client/services/visibility.client.service';

const ONE_SECOND = 1000;
const ONE_MINUTE = 60 * ONE_SECOND;
const FOREGROUND_POLLING_INTERVAL = 30 * ONE_SECOND;
const BACKGROUND_POLLING_INTERVAL = 5 * ONE_MINUTE;

let count: number | null = null;
let enabled = false;
let unwatchVisibility: (() => void) | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
const { subscribe, notify } = createSubscribable<number>();

/** Enables polling after the application has started. */
export function enable(): void {
  if (enabled) return;
  enabled = true;

  onClientEvent('userUpdated', () => {
    if (getCurrentUser()) {
      start();
    } else {
      stop();
    }
  });

  if (getCurrentUser()) {
    start();
  }
}

/** Disable the service. */
export function disable(): void {
  if (!enabled) return;
  enabled = false;
  stop();
}

/** Subscribe to updates to the unread message count. */
export function watch(fn: (count: number) => void): () => void {
  if (count !== null) fn(count);
  return subscribe(fn);
}

function start(): void {
  if (unwatchVisibility) unwatchVisibility();
  unwatchVisibility = watchVisibility(visible => {
    if (visible) {
      update();
      setPollingInterval(FOREGROUND_POLLING_INTERVAL);
    } else {
      setPollingInterval(BACKGROUND_POLLING_INTERVAL);
    }
  });
}

function stop(): void {
  if (timer) clearInterval(timer);
  if (unwatchVisibility) unwatchVisibility();
}

function setPollingInterval(interval: number): void {
  if (timer) clearInterval(timer);
  timer = setInterval(update, interval);
}

export async function update(): Promise<void> {
  const user = getCurrentUser();
  if (!user || !user.public) return;
  const newCount = await unreadCount();
  if (newCount === count) return;
  count = newCount;
  notify(count);
}
