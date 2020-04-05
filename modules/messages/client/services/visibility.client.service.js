/* eslint-disable */

import createSubscribable from 'modules/core/client/utils/subscribable';

const { subscribe, notify } = createSubscribable();

let visible = null;

/**
 * Watch for visibility changes.
 * Will call you immediately with the visiblity value, if already known.
 *
 * @param fn callback to be passed a boolean
 * @returns {function(...[*]=)} unsubscribe function
 */
export function watchVisibility(fn) {
  if (visible !== null) fn(visible);
  return subscribe(fn);
}

export function enable() {
  // Based on Quasar implementation
  // https://github.com/quasarframework/quasar/blob/dev/ui/src/plugins/AppVisibility.js

  let property, eventName;

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
  }
}
