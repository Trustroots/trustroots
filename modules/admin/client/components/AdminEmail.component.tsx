import { Alert } from '@trustroots/ui/Alert';
import { Button } from '@trustroots/ui/Button';
import React, { useEffect, useState } from 'react';
import httpClient from '../../../core/client/api/http-client';
import type { EmailQueueSnapshot } from '../../shared/email-queue.mts';
import AdminHeader from './AdminHeader.component';
import AdminEmailNavigation from './AdminEmailNavigation.component';

const number = new Intl.NumberFormat('en-GB');
const mailModes = {
  live: 'Live delivery',
  capture: 'Capture (outgoing delivery disabled)',
  allowlist: 'Delivery to allowlisted recipients',
};

function QueueHealth({ snapshot }: { snapshot: EmailQueueSnapshot }) {
  const rows = [
    ['Configured mail mode', mailModes[snapshot.mailMode]],
    [
      'Worker heartbeat',
      snapshot.workerHealthy ? 'Healthy' : 'No healthy heartbeat',
    ],
    ['Queued jobs', number.format(snapshot.queued)],
    ['Retrying jobs', number.format(snapshot.retrying)],
    [
      'Oldest due job',
      snapshot.oldestDueSeconds === 0
        ? 'None overdue'
        : `${number.format(Math.ceil(snapshot.oldestDueSeconds))} s overdue`,
    ],
    ['Stalled attempts', number.format(snapshot.stalledAttempts)],
    ['Retries exhausted (last 15 min)', number.format(snapshot.exhausted)],
    [
      'SMTP authentication or configuration failures (last 15 min)',
      number.format(snapshot.authenticationOrConfiguration),
    ],
    [
      'Longest attempt (last 15 min)',
      snapshot.maxProcessingMs === null
        ? 'No recent attempts'
        : `${number.format(snapshot.maxProcessingMs)} ms`,
    ],
  ];

  return (
    <>
      <p>Checked at {snapshot.capturedAt.slice(0, 19).replace('T', ' ')} UTC</p>
      <table className="table table-condensed">
        <thead>
          <tr>
            <th scope="col">Metric</th>
            <th scope="col">Current reading</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export default function AdminEmail() {
  const [refresh, setRefresh] = useState(0);
  const [snapshot, setSnapshot] = useState<EmailQueueSnapshot | null>(null);
  const [error, setError] = useState(false);
  const loading = !snapshot && !error;

  useEffect(() => {
    const controller = new AbortController();
    httpClient
      .get<EmailQueueSnapshot>('/api/admin/email/queue-health', {
        signal: controller.signal,
      })
      .then(
        ({ data }) => {
          if (!controller.signal.aborted) setSnapshot(data);
        },
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
        <h2>Email administration</h2>
        <AdminEmailNavigation current="/admin/email" />
        <section aria-labelledby="email-queue-heading">
          <h3 id="email-queue-heading">Email queue and worker</h3>
          <p>
            Queue readings cover application emails and deployment
            notifications.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => {
              setSnapshot(null);
              setError(false);
              setRefresh(value => value + 1);
            }}
          >
            Refresh queue health
          </Button>
          {loading && <p role="status">Loading email queue health…</p>}
          {error && (
            <Alert intent="danger" role="alert">
              Could not load email queue health.
            </Alert>
          )}
          {snapshot && <QueueHealth snapshot={snapshot} />}
        </section>
      </main>
    </>
  );
}
