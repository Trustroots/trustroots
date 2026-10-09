export function ready(fn?: () => void): void {
  if (typeof fn !== 'function') return;
  if (document.readyState !== 'loading') {
    fn();
    return;
  }
  document.addEventListener('DOMContentLoaded', fn, false);
}

let webPSupported: boolean | undefined;

/** Check WebP decoding without reading canvas pixels or prompting for permission. */
export function canUseWebP(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  if (webPSupported === undefined) {
    // Keep JPEG as the fallback while the one-off image probe is pending.
    webPSupported = false;
    const image = new window.Image();
    image.onload = () => {
      webPSupported = image.naturalWidth === 1 && image.naturalHeight === 1;
    };
    image.onerror = () => {
      webPSupported = false;
    };
    image.src =
      'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';
  }

  return webPSupported;
}
