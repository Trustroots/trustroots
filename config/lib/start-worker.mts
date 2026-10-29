type Done = (error?: Error | null) => void;

/** Start each stage only after the previous one has completed. */
export async function startWorker(
  database: {
    connect: (callback: () => void) => void;
    loadModels: (callback: Done) => void;
  },
  worker: {
    unlockAgendaJobs: (callback: Done) => void;
    start: (
      options: { maxAttempts: number; retryDelaySeconds: number },
      callback: Done,
    ) => void;
  },
): Promise<void> {
  await new Promise<void>(resolve => database.connect(resolve));
  await new Promise<void>((resolve, reject) =>
    database.loadModels(error => (error ? reject(error) : resolve())),
  );
  // Attempt to unlock jobs that were stuck due to a server restart.
  await new Promise<void>((resolve, reject) =>
    worker.unlockAgendaJobs(error => (error ? reject(error) : resolve())),
  );
  await new Promise<void>((resolve, reject) =>
    worker.start({ maxAttempts: 10, retryDelaySeconds: 10 }, error =>
      error ? reject(error) : resolve(),
    ),
  );
}
