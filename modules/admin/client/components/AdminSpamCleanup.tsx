import React, { useState } from 'react';
import http, { getErrorMessage } from '../../../core/client/api/http-client';
import AdminHeader from './AdminHeader.component';
import { formatAdminDateTime } from '../utils/admin-date';
interface Batch {
  previewId: string;
  expiresAt: string;
  building: boolean;
  candidates: number;
  eligible: number;
  protected: number;
  page: number;
  pages: number;
  items: Array<{
    id: string;
    username: string;
    created: string | null;
    eligible: boolean;
  }>;
}
interface Progress {
  deleted: number;
  skipped: number;
  done: boolean;
}
export default function AdminSpamCleanup() {
  const [batch, setBatch] = useState<Batch | null>(null);
  const [selection, setSelection] = useState<'all' | 'selected'>('selected');
  const [exceptions, setExceptions] = useState<Set<string>>(new Set());
  const [confirmed, setConfirmed] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Progress | null>(null);
  const selected =
    selection === 'all'
      ? (batch?.eligible ?? 0) - exceptions.size
      : exceptions.size;
  async function preview() {
    setWorking(true);
    setError('');
    setConfirmed(false);
    setBatch(null);
    setResult(null);
    setSelection('selected');
    setExceptions(new Set());
    try {
      let response = await http.post<Batch>(
        '/api/admin/spam-cleanup/preview',
        {},
      );
      setBatch(response.data);
      while (response.data.building) {
        response = await http.post<Batch>('/api/admin/spam-cleanup/preview', {
          previewId: response.data.previewId,
        });
        setBatch(response.data);
      }
    } catch (cause) {
      setError(
        getErrorMessage(
          cause,
          'Unable to preview cleanup. Start a fresh preview.',
        ),
      );
      setBatch(null);
    } finally {
      setWorking(false);
    }
  }
  async function page(page: number, previewId: string) {
    setWorking(true);
    setError('');
    try {
      setBatch(
        (
          await http.post<Batch>('/api/admin/spam-cleanup/preview', {
            previewId,
            page,
          })
        ).data,
      );
    } catch (cause) {
      setError(getErrorMessage(cause, 'Unable to load this page.'));
    } finally {
      setWorking(false);
    }
  }
  async function apply(previewId: string) {
    setWorking(true);
    setError('');
    setResult(null);
    const body = {
      previewId,
      confirm: true,
      selection,
      accountIds: [...exceptions],
    };
    try {
      let progress: Progress;
      do {
        progress = (
          await http.post<Progress>('/api/admin/spam-cleanup/apply', body)
        ).data;
        setResult(progress);
      } while (!progress.done);
      setBatch(null);
      setConfirmed(false);
    } catch (cause) {
      setError(
        getErrorMessage(
          cause,
          'Cleanup interrupted. Start a fresh preview to check remaining accounts.',
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
          Preview all matching accounts, select all eligible accounts or choose
          individuals, then confirm permanent deletion. Accounts are processed
          in internal batches with eligibility rechecked. Keep this page open
          until scanning or deletion completes.
        </p>
        <button
          type="button"
          className="btn btn-default"
          disabled={working}
          onClick={() => void preview()}
        >
          Preview all accounts
        </button>
        {working && (
          <p role="status">
            Working…{' '}
            {batch?.building && `Scanned ${batch.candidates} candidates.`}
          </p>
        )}
        {error && <p role="alert">{error}</p>}
        {result && (
          <p role="status">
            {result.done ? 'Complete.' : 'Processing…'} Deleted {result.deleted}
            ; skipped {result.skipped} after rechecking eligibility.
          </p>
        )}
        {batch && !batch.building && (
          <section aria-label="Cleanup preview">
            <p role="status">
              Full preview: {batch.candidates} candidates; {batch.eligible}{' '}
              eligible; {batch.protected} protected. {selected} selected across
              all pages.
            </p>
            <p>
              Expires after 15 minutes of inactivity. Page {batch.page} of{' '}
              {Math.max(1, batch.pages)}.
            </p>
            <button
              type="button"
              className="btn btn-default"
              disabled={working}
              onClick={() => {
                setSelection('all');
                setExceptions(new Set());
                setConfirmed(false);
              }}
            >
              Select all eligible accounts
            </button>{' '}
            <button
              type="button"
              className="btn btn-default"
              disabled={working}
              onClick={() => {
                setSelection('selected');
                setExceptions(new Set());
                setConfirmed(false);
              }}
            >
              Clear selection
            </button>
            <table className="table table-striped">
              <thead>
                <tr>
                  <th>Select</th>
                  <th>Account</th>
                  <th>Created</th>
                  <th>Decision</th>
                </tr>
              </thead>
              <tbody>
                {batch.items.map(item => (
                  <tr key={item.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select ${item.username}`}
                        disabled={working || !item.eligible}
                        checked={
                          item.eligible &&
                          (selection === 'all'
                            ? !exceptions.has(item.id)
                            : exceptions.has(item.id))
                        }
                        onChange={() => {
                          setExceptions(current => {
                            const next = new Set(current);
                            if (next.has(item.id)) next.delete(item.id);
                            else next.add(item.id);
                            return next;
                          });
                          setConfirmed(false);
                        }}
                      />
                    </td>
                    <td>
                      <a
                        href={`/admin/user/${encodeURIComponent(item.username)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {item.username}
                      </a>
                    </td>
                    <td>
                      {item.created
                        ? formatAdminDateTime(item.created)
                        : 'Not available'}
                    </td>
                    <td>
                      {item.eligible
                        ? 'Eligible for deletion'
                        : 'Protected or no longer available — retained'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              type="button"
              disabled={working || batch.page <= 1}
              onClick={() => void page(batch.page - 1, batch.previewId)}
            >
              Previous accounts
            </button>{' '}
            <button
              type="button"
              disabled={working || batch.page >= batch.pages}
              onClick={() => void page(batch.page + 1, batch.previewId)}
            >
              Next accounts
            </button>
            <p>
              <label>
                <input
                  type="checkbox"
                  disabled={working}
                  checked={confirmed}
                  onChange={event => setConfirmed(event.target.checked)}
                />{' '}
                I reviewed this selection and understand deletion is permanent.
              </label>
            </p>
            <button
              type="button"
              className="btn btn-danger"
              disabled={working || !confirmed || selected === 0}
              onClick={() => void apply(batch.previewId)}
            >
              Delete {selected} selected accounts
            </button>
          </section>
        )}
      </main>
    </>
  );
}
