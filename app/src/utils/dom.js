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

/**
 * Does browser support webp image format?
 * @return {[bool]}
 */
export function canUseWebP() {
  if (typeof window !== 'undefined') {
    const elem = document.createElement('canvas');
    if (elem.getContext?.('2d')) {
      return elem.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    }
  }
  return false;
}
