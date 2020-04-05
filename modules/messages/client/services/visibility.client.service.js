import createSubscribable from '@/modules/core/client/utils/subscribable';

const { subscribe, notify } = createSubscribable();

let enabled = false;
let visible = null;
let removeEventListener;

/**
 * Watch for visibility changes.
 * Will call you immediately with the visiblity value, if already known.
 *
 * @param fn callback to be passed a boolean
 * @returns {function(...[*]=)} unsubscribe function
 */
export function watch(fn) {
  if (visible !== null) fn(visible);
  return subscribe(fn);
}

export function enable() {
  if (enabled) return;
  enabled = true;
  // Based on Quasar implementation
  // https://github.com/quasarframework/quasar/blob/dev/ui/src/plugins/AppVisibility.js

  let property;
  let eventName;

  if (typeof document.hidden !== 'undefined') {
    // Opera 12.10 and Firefox 18 and later support
    property = 'hidden';
    eventName = 'visibilitychange';
  } else if (typeof document.msHidden !== 'undefined') {
    property = 'msHidden';
    eventName = 'msvisibilitychange';
  } else if (typeof document.webkitHidden !== 'undefined') {
    property = 'webkitHidden';
    eventName = 'webkitvisibilitychange';
  }

  function update() {
    visible = !document[property];
    notify(visible);
  }

  update();

  if (eventName && typeof document[property] !== 'undefined') {
    document.addEventListener(eventName, update, false);
    removeEventListener = () => {
      document.removeEventListener(eventName, update);
      removeEventListener = null;
    };
  }
}

export function disable() {
  if (!enabled) return;
  enabled = false;
  if (removeEventListener) removeEventListener();
}
