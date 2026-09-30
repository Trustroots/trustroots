export function ready(fn?: () => void): void {
  if (typeof fn !== 'function') return;
  if (document.readyState !== 'loading') {
    fn();
    return;
  }
  document.addEventListener('DOMContentLoaded', fn, false);
}

/** Does the browser support the WebP image format? */
export function canUseWebP(): boolean {
  if (typeof window !== 'undefined') {
    const elem = document.createElement('canvas');
    if (elem.getContext?.('2d')) {
      return elem.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    }
  }
  return false;
}
