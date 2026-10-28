import React, { useState } from 'react';
import http, { getErrorMessage } from '../../../core/client/api/http-client';
import AdminHeader from './AdminHeader.component';
import { formatAdminDateTime } from '../utils/admin-date';
interface Batch {
  previewId: string;
  expiresAt: string;
  eligible: number;
  protected: number;
  hasMore: boolean;
  items: Array<{
    id: string;
    username: string;
    created: string;
    eligible: boolean;
  }>;
}
export default function AdminSpamCleanup() {
  const [batch, setBatch] = useState<Batch | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    deleted: number;
    skipped: number;
  } | null>(null);
  async function preview(after?: string) {
    setWorking(true);
    setError('');
    setConfirmed(false);
    setBatch(null);
    setResult(null);
    try {
      const response = await http.post<Batch>(
        '/api/admin/spam-cleanup/preview',
        after ? { after } : {},
      );
      setBatch(response.data);
    } catch (cause) {
      setError(getErrorMessage(cause, 'Unable to preview cleanup.'));
    } finally {
      setWorking(false);
    }
  }
  async function apply(previewId: string) {
    setWorking(true);
    setError('');
    try {
      const response = await http.post<{ deleted: number; skipped: number }>(
        '/api/admin/spam-cleanup/apply',
        { previewId, confirm: true },
      );
      setResult(response.data);
      setBatch(null);
      setConfirmed(false);
    } catch (cause) {
      setError(
        getErrorMessage(
          cause,
          'Unable to complete cleanup. Preview again before retrying.',
        ),
      );
      setBatch(null);
      setConfirmed(false);
    } finally {
      setWorking(false);
    }
  }
  return (
    <>
      <AdminHeader />
      <main className="container admin-page">
        <h1>Spam account cleanup</h1>
        <p>
          Review inactive suspended accounts from the July 2021 and February
          2023 signup campaigns. Existing member activity and moderation notes
          protect accounts from deletion. Campaign criteria are fixed.
        </p>
        <p>
          Previews contain up to 100 accounts and expire after 15 minutes.
          Deletion is permanent; eligibility is checked again when you apply.
        </p>
        <button
          type="button"
          className="btn btn-default"
          disabled={working}
          onClick={() => void preview()}
        >
          Preview first batch
        </button>
        {working && <p role="status">Working…</p>}
        {error && <p role="alert">{error}</p>}
        {result && (
          <p role="status">
            Deleted {result.deleted}; skipped {result.skipped} after rechecking
            eligibility. Preview again to see remaining accounts.
          </p>
        )}
        {batch && (
          <section aria-label="Cleanup preview">
            <p role="status">
              This batch: {batch.items.length} candidates; {batch.eligible}{' '}
              eligible; {batch.protected} protected.
            </p>
            <p>Expires {formatAdminDateTime(batch.expiresAt)}.</p>
            <table className="table table-striped">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Created</th>
                  <th>Decision</th>
                </tr>
              </thead>
              <tbody>
                {batch.items.map(item => (
                  <tr key={item.id}>
                    <td>
                      <a
                        href={`/admin/user/${encodeURIComponent(item.username)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {item.username}
                      </a>
                    </td>
                    <td>{formatAdminDateTime(item.created)}</td>
                    <td>
                      {item.eligible
                        ? 'Eligible for deletion'
                        : 'Protected activity — retained'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <label>
              <input
                type="checkbox"
                checked={confirmed}
                disabled={working}
                onChange={event => setConfirmed(event.target.checked)}
              />{' '}
              I reviewed this batch and understand deletion is permanent.
            </label>
            <p>
              <button
                type="button"
                className="btn btn-danger"
                disabled={working || !confirmed || batch.eligible === 0}
                onClick={() => void apply(batch.previewId)}
              >
                Delete {batch.eligible} eligible accounts
              </button>
            </p>
            {batch.hasMore && (
              <button
                type="button"
                className="btn btn-default"
                disabled={working}
                onClick={() =>
                  void preview(batch.items[batch.items.length - 1].id)
                }
              >
                Preview next batch without deleting
              </button>
            )}
          </section>
        )}
      </main>
    </>
  );
}
