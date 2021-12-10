/**
 * PollMessagesCount service used for automatically polling for unread message counter
 */

import { $on, getUser } from '@/modules/core/client/services/angular-compat';
import createSubscribable from '@/modules/core/client/utils/subscribable';
import { unreadCount } from '@/modules/messages/client/api/messages.api';
import { watch as watchVisibility } from '@/modules/messages/client/services/visibility.client.service';

const ONE_SECOND = 1000;
const ONE_MINUTE = 60 * ONE_SECOND;

const FOREGROUND_POLLING_INTERVAL = 30 * ONE_SECOND;
const BACKGROUND_POLLING_INTERVAL = 5 * ONE_MINUTE;

// store the current value of count to send to new subscribers
let count = null;

// whether service is enabled or not
// even if enabled, will only poll when there is a logged in user
let enabled = false;

// visiblity watcher unsubscribe function, so we can unsubscribe when stopped
let unwatchVisibility;

// the polling interval timer ID so we can cancel it to change/stop interval
let timer;

// manage subscribers to our unread count service
const { subscribe, notify } = createSubscribable();

/**
 * Enables the service.
 * Do this once the application has started up.
 * It won't start polling until there is a user available.
 */
export function enable() {
  if (enabled) return;
  enabled = true;

  $on('userUpdated', () => {
    if (getUser()) {
      start();
    } else {
      stop();
    }
  });

  if (getUser()) {
    start();
  }
}

/**
 * Disable the service.
 */
export function disable() {
  if (!enabled) return;
  enabled = false;
  stop();
}

/**
 * Subscribe to keep updated with the unread messages count!
 * Will send you the current value immediately if we already have it.
 *
 * It returns an unsubscribe function, which can be used with react
 * hooks nicely, e.g.:
 *
 *   const [count, setCount] = useState(null);
 *   useEffect(() => watchUnreadMessageCount(setCount), []);
 *
 * @param fn callback to be passed the value
 * @returns {function(...[*]=)} unsubscribe function
 */
export function watch(fn) {
  if (count !== null) fn(count);
  return subscribe(fn);
}

function start() {
  if (unwatchVisibility) unwatchVisibility();
  unwatchVisibility = watchVisibility(visible => {
    if (visible) {
      update(); // updates on initial view and when returning
      setPollingInterval(FOREGROUND_POLLING_INTERVAL);
    } else {
      setPollingInterval(BACKGROUND_POLLING_INTERVAL);
    }
  });
}

function stop() {
  if (timer) clearInterval(timer);
  if (unwatchVisibility) unwatchVisibility();
}

function setPollingInterval(interval) {
  if (timer) clearInterval(timer);
  timer = setInterval(update, interval);
}

export async function update() {
  const user = getUser();
  if (!user || !user.public) return;
  const newCount = await unreadCount();
  if (newCount === count) return;
  count = newCount;
  notify(count);
}
