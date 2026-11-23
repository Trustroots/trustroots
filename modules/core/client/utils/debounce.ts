export function debounce<Args extends unknown[]>(
  callback: (...args: Args) => void,
  wait: number,
  maxWait?: number,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let maxTimer: ReturnType<typeof setTimeout> | undefined;
  let latestArgs: Args;

  const cancel = () => {
    clearTimeout(timer);
    clearTimeout(maxTimer);
    timer = maxTimer = undefined;
  };
  const invoke = () => {
    cancel();
    callback(...latestArgs);
  };
  const debounced = (...args: Args) => {
    latestArgs = args;
    clearTimeout(timer);
    timer = setTimeout(invoke, wait);
    if (maxWait !== undefined) maxTimer ??= setTimeout(invoke, maxWait);
  };
  debounced.cancel = cancel;
  return debounced;
}
