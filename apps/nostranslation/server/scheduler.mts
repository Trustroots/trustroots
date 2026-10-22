/** Start the next run after completion, so slow jobs never overlap. */
export function schedule(
  run: () => Promise<unknown>,
  onError: () => void,
  interval: number,
) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tick = async () => {
    try {
      await run();
    } catch {
      onError();
    }
    if (!stopped) timer = setTimeout(() => void tick(), interval);
  };
  void tick();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
