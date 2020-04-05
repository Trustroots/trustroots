// Based on Quasar implementation
// https://github.com/quasarframework/quasar/blob/1c09e8bb1ec63dde567b05f1a42d2ad0fcfd48d3/ui/src/utils/dom.js#L37-L47
export function ready(fn) {
  if (typeof fn !== 'function') {
    return;
  }

  if (document.readyState !== 'loading') {
    return fn();
  }

  document.addEventListener('DOMContentLoaded', fn, false);
}
