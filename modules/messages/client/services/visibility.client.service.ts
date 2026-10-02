import createSubscribable from '@/modules/core/client/utils/subscribable';

const { subscribe, notify } = createSubscribable<boolean>();

type VisibilityDocument = Document & {
  msHidden?: boolean;
  webkitHidden?: boolean;
};

type VisibilityProperty = 'hidden' | 'msHidden' | 'webkitHidden';

let enabled = false;
let visible: boolean | null = null;
let removeEventListener: (() => void) | null = null;

/** Watch for visibility changes and immediately report a known value. */
export function watch(fn: (visible: boolean) => void): () => void {
  if (visible !== null) fn(visible);
  return subscribe(fn);
}

export function enable(): void {
  if (enabled) return;
  enabled = true;

  let property: VisibilityProperty | undefined;
  let eventName: string | undefined;
  const visibilityDocument = document as VisibilityDocument;

  if (typeof document.hidden !== 'undefined') {
    property = 'hidden';
    eventName = 'visibilitychange';
  } else if (typeof visibilityDocument.msHidden !== 'undefined') {
    property = 'msHidden';
    eventName = 'msvisibilitychange';
  } else if (typeof visibilityDocument.webkitHidden !== 'undefined') {
    property = 'webkitHidden';
    eventName = 'webkitvisibilitychange';
  }

  function update() {
    visible = !visibilityDocument[property as VisibilityProperty];
    notify(visible);
  }

  update();

  if (
    eventName &&
    typeof visibilityDocument[property as VisibilityProperty] !== 'undefined'
  ) {
    document.addEventListener(eventName, update, false);
    removeEventListener = () => {
      document.removeEventListener(eventName as string, update);
      removeEventListener = null;
    };
  }
}

export function disable(): void {
  if (!enabled) return;
  enabled = false;
  if (removeEventListener) removeEventListener();
}
