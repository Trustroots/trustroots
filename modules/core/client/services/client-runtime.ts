export function broadcastClientEvent(
  eventName: string,
  ...args: unknown[]
): boolean {
  return window.dispatchEvent(
    new CustomEvent(`tr:${eventName}`, {
      detail: args,
    }),
  );
}

export function onClientEvent(
  eventName: string,
  listener: (error: null, ...args: unknown[]) => void,
): () => void {
  const eventListener = (event: Event) =>
    listener(null, ...((event as CustomEvent<unknown[]>).detail || []));

  window.addEventListener(`tr:${eventName}`, eventListener);

  return () => window.removeEventListener(`tr:${eventName}`, eventListener);
}
