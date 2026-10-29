import type { Job } from 'agenda';

export function startSupportMailboxHeartbeat(job: Pick<Job, 'touch'>) {
  let heartbeatError: unknown;
  const interval = setInterval(() => {
    void job.touch.call(job as Job).catch(error => {
      heartbeatError = error;
    });
  }, 60_000);
  interval.unref();
  return {
    assertHealthy() {
      if (heartbeatError) throw heartbeatError;
    },
    stop() {
      clearInterval(interval);
    },
  };
}
