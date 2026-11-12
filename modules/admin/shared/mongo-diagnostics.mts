export type AgendaCollection = 'agendaJobs' | 'agendaJobsArchived';

export type AgendaCollectionStorage =
  | { name: AgendaCollection; status: 'missing' | 'unavailable' }
  | {
      name: AgendaCollection;
      status: 'available';
      count: number;
      storageBytes: number;
      indexBytes: number;
      reusableBytes: number | null;
    };

export const AGENDA_JOB_STATES = [
  'queued',
  'locked',
  'completed',
  'failed',
  'disabled',
  'unscheduled',
] as const;

export type AgendaJobState = (typeof AGENDA_JOB_STATES)[number];

export interface AgendaJobCounts {
  name: string;
  counts: Partial<Record<AgendaJobState, number>>;
}

export interface MongoServerDiagnostics {
  version: string | null;
  topology: 'standalone' | 'replicaSet' | 'sharded' | null;
  fcv: {
    version: string;
    targetVersion: string | null;
    transitioning: boolean;
  } | null;
}

export interface MongoDiagnosticsSnapshot {
  capturedAt: string;
  server: MongoServerDiagnostics;
  collections: AgendaCollectionStorage[];
  jobs: AgendaJobCounts[] | null;
}
