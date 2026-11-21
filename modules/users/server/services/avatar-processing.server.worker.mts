import { fork } from 'node:child_process';
import { addAbortListener } from 'node:events';
import { fileURLToPath } from 'node:url';

const workerPath = fileURLToPath(
  new URL('./avatar-processing.server.child.mjs', import.meta.url),
);

export default async function processAvatarImage(
  sourcePath: string,
  stageDir: string,
  signal: AbortSignal,
): Promise<void> {
  signal.throwIfAborted();
  await new Promise<void>((resolve, reject) => {
    const child = fork(workerPath, [sourcePath, stageDir], {
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    });
    let workerError: Error | undefined;
    const cancellation = addAbortListener(signal, () => {
      child.kill('SIGKILL');
    });
    child.on('message', (message: string) => {
      workerError = new Error(message);
    });
    child.once('error', error => {
      workerError = error;
    });
    // Close follows exit (or a spawn error) and lets the last IPC message arrive.
    child.once('close', code => {
      cancellation[Symbol.dispose]();
      if (signal.aborted) reject(signal.reason);
      else if (code === 0) resolve();
      else reject(workerError ?? new Error('Avatar processing failed.'));
    });
  });
}
