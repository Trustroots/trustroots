declare module 'async' {
  type AsyncCallback = (error?: Error | null) => void;

  interface Queue<T> {
    push(task: T): void;
    error(handler: (error: Error, task: T) => void): void;
    drain: (() => void) | null;
    length(): number;
  }

  export function queue<T>(
    worker: (task: T, callback: AsyncCallback) => void | Promise<void>,
    concurrency?: number,
  ): Queue<T>;
}
