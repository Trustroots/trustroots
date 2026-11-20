import React, { useEffect, useState } from 'react';
import { Button } from '@trustroots/ui/Button';
import httpClient from '../../../core/client/api/http-client';
import {
  AGENDA_JOB_STATES,
  type AgendaCollectionStorage,
  type AgendaStorageSample,
  type MongoDiagnosticsSnapshot,
} from '../../shared/mongo-diagnostics.mts';
import AdminHeader from './AdminHeader.component';

const number = new Intl.NumberFormat('en-GB');
const decimal = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 });
const byteUnits = [
  { label: 'GB', divisor: 1_000_000_000 },
  { label: 'MB', divisor: 1_000_000 },
  { label: 'kB', divisor: 1_000 },
  { label: 'B', divisor: 1 },
];
const stateLabels = {
  queued: 'Queued',
  locked: 'Locked',
  completed: 'Completed',
  failed: 'Failed',
  disabled: 'Disabled',
  unscheduled: 'Unscheduled',
};
const topologyLabels = {
  standalone: 'Standalone',
  replicaSet: 'Replica set',
  sharded: 'Sharded cluster',
};
const supportedVersions = ['4.4', '5.0', '6.0', '7.0'];

function migrationContext(
  serverVersion: string | null,
  fcvVersion: string | null,
) {
  if (!serverVersion || !fcvVersion) return 'Migration context unavailable';
  const serverSeries = serverVersion.split('.').slice(0, 2).join('.');
  const fcvSeries = fcvVersion.split('.').slice(0, 2).join('.');
  if (serverSeries !== fcvSeries) return 'Server version and FCV do not match';
  const index = supportedVersions.indexOf(fcvSeries);
  if (index < 0) return 'Outside this migration path';
  if (index === supportedVersions.length - 1) return 'Aligned at 7.0';
  return `Aligned. Next series is ${supportedVersions[index + 1]}.`;
}

export default function AdminMongo() {
  const [refresh, setRefresh] = useState(0);
  const [snapshot, setSnapshot] = useState<MongoDiagnosticsSnapshot | null>(
    null,
  );
  const [error, setError] = useState(false);
  const loading = !snapshot && !error;

  useEffect(() => {
    const controller = new AbortController();
    httpClient
      .get<MongoDiagnosticsSnapshot>(
        refresh ? '/api/admin/mongo?liveJobs=true' : '/api/admin/mongo',
        { signal: controller.signal },
      )
      .then(
        ({ data }) => setSnapshot(data),
        () => {
          if (!controller.signal.aborted) setError(true);
        },
      );
    return () => controller.abort();
  }, [refresh]);

  return (
    <>
      <AdminHeader />
      <main className="tw:page-container">
        <h2>MongoDB diagnostics</h2>
        <Button
          type="button"
          disabled={loading}
          onClick={() => {
            setSnapshot(null);
            setError(false);
            setRefresh(value => value + 1);
          }}
        >
          Refresh snapshot
        </Button>
        {loading && <p role="status">Loading MongoDB diagnostics…</p>}
        {error && (
          <p role="alert">
            Could not load MongoDB diagnostics. Try refreshing the snapshot.
          </p>
        )}
        {snapshot && (
          <>
            <p>
              Snapshot{' '}
              <time dateTime={snapshot.capturedAt}>
                {snapshot.capturedAt.slice(0, 19).replace('T', ' ')} UTC
              </time>
            </p>
            <h3>Migration metadata</h3>
            <div className="table-responsive">
              <table
                className="table table-striped"
                aria-label="MongoDB migration metadata"
              >
                <tbody>
                  <tr>
                    <th scope="row">Connected server version</th>
                    <td>{snapshot.server.version ?? 'Unknown'}</td>
                  </tr>
                  <tr>
                    <th scope="row">Feature compatibility version (FCV)</th>
                    <td>
                      {snapshot.server.fcv ? (
                        <>
                          {snapshot.server.fcv.version}
                          {snapshot.server.fcv.transitioning &&
                          snapshot.server.fcv.targetVersion
                            ? ` → ${snapshot.server.fcv.targetVersion} (transition in progress)`
                            : ''}
                        </>
                      ) : (
                        'Unknown'
                      )}
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Topology</th>
                    <td>
                      {snapshot.server.topology
                        ? topologyLabels[snapshot.server.topology]
                        : 'Unknown'}
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Migration context</th>
                    <td>
                      {snapshot.server.fcv?.transitioning
                        ? 'FCV transition in progress'
                        : migrationContext(
                            snapshot.server.version,
                            snapshot.server.fcv?.version ?? null,
                          )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              Upgrade path <strong>4.4 → 5.0 → 6.0 → 7.0</strong>
            </p>
            <p>
              <a href="https://github.com/Trustroots/trustroots/blob/main/docs/mongodb-7-migration-runbook.md">
                MongoDB 7 migration runbook
              </a>
              {' · '}
              <a href="https://github.com/Trustroots/trustroots/issues/3455">
                Issue #3455
              </a>
            </p>
            <h3>Collection storage</h3>
            <p>
              Allocated data includes space MongoDB can reuse. Indexes are
              measured separately.{' '}
              <a href="https://github.com/Trustroots/trustroots/issues/2714">
                Agenda storage issue #2714
              </a>
            </p>
            <CollectionStorageTable
              label="Collection storage"
              samples={[snapshot]}
            />
            <h3>Agenda jobs by name</h3>
            {snapshot.jobsCapturedAt && (
              <p>
                Saved inventory from{' '}
                <time dateTime={snapshot.jobsCapturedAt}>
                  {snapshot.jobsCapturedAt.slice(0, 19).replace('T', ' ')} UTC
                </time>
              </p>
            )}
            {snapshot.jobs === null ? (
              <p role="alert">
                Live job counts are unavailable. The daily worker also
                calculates this breakdown and saves the last successful result.
              </p>
            ) : snapshot.jobs.length === 0 ? (
              <p>No Agenda jobs.</p>
            ) : (
              <>
                <p>
                  Queued includes future runs and retries. Locked counts any
                  recorded lock, including stale locks. Jobs are ordered by
                  uncompressed BSON size, which measures document data and can
                  differ from allocated disk space.
                </p>
                <div className="table-responsive">
                  <table
                    className="table table-striped"
                    aria-label="Agenda jobs by name"
                  >
                    <thead>
                      <tr>
                        <th scope="col">Job name</th>
                        <th scope="col">Total</th>
                        <th scope="col">BSON size</th>
                        {AGENDA_JOB_STATES.map(state => (
                          <th key={state} scope="col">
                            {stateLabels[state]}
                          </th>
                        ))}
                        <th scope="col">Oldest completed (UTC)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.jobs.map(job => (
                        <tr key={job.name}>
                          <th scope="row">{job.name}</th>
                          <td>{number.format(job.total)}</td>
                          <ByteSizeCell bytes={job.bsonBytes} />
                          {AGENDA_JOB_STATES.map(state => (
                            <td key={state}>
                              {number.format(job.counts[state] ?? 0)}
                            </td>
                          ))}
                          <td>
                            {job.oldestCompletedAt ? (
                              <time dateTime={job.oldestCompletedAt}>
                                {job.oldestCompletedAt.slice(0, 10)}
                              </time>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <h3>Daily Agenda storage</h3>
            {snapshot.history === null ? (
              <p role="alert">Daily storage history is unavailable.</p>
            ) : snapshot.history.length === 0 ? (
              <p>No daily storage snapshots have been captured yet.</p>
            ) : (
              <>
                <p>
                  The worker keeps one snapshot per day for the last 30 UTC
                  dates.
                </p>
                <CollectionStorageTable
                  label="Daily Agenda storage"
                  samples={snapshot.history}
                  showDate
                />
              </>
            )}
          </>
        )}
      </main>
    </>
  );
}

function CollectionStorageTable({
  label,
  samples,
  showDate = false,
}: {
  label: string;
  samples: AgendaStorageSample[];
  showDate?: boolean;
}) {
  return (
    <div className="table-responsive">
      <table className="table table-striped" aria-label={label}>
        <thead>
          <tr>
            {showDate && <th scope="col">Date (UTC)</th>}
            <th scope="col">Collection</th>
            <th scope="col">Documents</th>
            <th scope="col">Allocated data</th>
            <th scope="col">Indexes</th>
            <th scope="col">Reusable data</th>
          </tr>
        </thead>
        <tbody>
          {samples.flatMap(sample =>
            sample.collections.map(collection => (
              <tr key={`${sample.capturedAt}:${collection.name}`}>
                {showDate && (
                  <td>
                    <time dateTime={sample.capturedAt}>
                      {sample.capturedAt.slice(0, 10)}
                    </time>
                  </td>
                )}
                <th scope="row">{collection.name}</th>
                <CollectionStorageCells collection={collection} />
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}

function CollectionStorageCells({
  collection,
}: {
  collection: AgendaCollectionStorage;
}) {
  if (collection.status !== 'available') {
    return (
      <td colSpan={4}>
        {collection.status === 'missing'
          ? 'Collection does not exist'
          : 'Storage statistics unavailable'}
      </td>
    );
  }
  return (
    <>
      <td>{number.format(collection.count)}</td>
      <ByteSizeCell bytes={collection.storageBytes} />
      <ByteSizeCell bytes={collection.indexBytes} />
      {collection.reusableBytes === null ? (
        <td>Unavailable</td>
      ) : (
        <ByteSizeCell bytes={collection.reusableBytes} />
      )}
    </>
  );
}

function ByteSizeCell({ bytes }: { bytes: number }) {
  const unit = byteUnits.find(({ divisor }) => bytes >= divisor);
  const size = unit
    ? `${decimal.format(bytes / unit.divisor)} ${unit.label}`
    : '0 B';
  return <td title={`${number.format(bytes)} bytes`}>{size}</td>;
}
