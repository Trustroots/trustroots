import log from './../../../../config/lib/logger.mjs';

export type TaskQueue<T> = {
  length(): number;
  push(task: T): void;
};

/**
 * Runs pushed tasks with at most `concurrency` in flight. Like `async.queue`,
 * work starts on a later turn of the event loop, so `length()` counts every
 * task pushed in the current turn as waiting.
 */
export function createTaskQueue<T>(
  worker: (task: T) => Promise<unknown>,
  concurrency: number,
): TaskQueue<T> {
  const waiting: T[] = [];
  let running = 0;
  let scheduled = false;

  function processWaiting() {
    scheduled = false;
    while (running < concurrency && waiting.length > 0) {
      const task = waiting.shift() as T;
      running += 1;
      void worker(task)
        // Workers report their own results; surface anything that escapes
        // rather than letting it stall the queue.
        .catch((error: unknown) => {
          log('error', 'Queued task failed.', { error });
        })
        .finally(() => {
          running -= 1;
          processWaiting();
        });
    }
  }

  return {
    length: () => waiting.length,
    push(task) {
      waiting.push(task);
      if (!scheduled) {
        scheduled = true;
        setImmediate(processWaiting);
      }
    },
  };
}

/**
 * Calls `fn` for every item in order, with at most `limit` calls in flight.
 * Rejects with the first rejection of `fn`, like `Promise.all`.
 */
export async function forEachWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<unknown>,
): Promise<void> {
  let next = 0;
  let failed = false;
  const worker = async () => {
    while (!failed && next < items.length) {
      const index = next++;
      try {
        await fn(items[index], index);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
}

const taskQueueService = { createTaskQueue, forEachWithConcurrency };
export default taskQueueService;
export { taskQueueService as 'module.exports' };
