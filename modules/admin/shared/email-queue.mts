export interface EmailQueueSnapshot {
  capturedAt: string;
  mailMode: 'live' | 'capture' | 'allowlist';
  queued: number;
  oldestDueSeconds: number;
  retrying: number;
  exhausted: number;
  authenticationOrConfiguration: number;
  workerHealthy: boolean;
  stalledAttempts: number;
  maxProcessingMs: number | null;
}
