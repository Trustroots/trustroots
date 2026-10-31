import React, { useState, useEffect } from 'react';
import { getRecoveryAccounts, sendRecovery } from '../api/sparkpost.api';
import type { RecoveryDay, RecoveryResult } from '../../shared/sparkpost';
export default function SignupRecovery({
  from,
  to,
}: {
  from: string;
  to: string;
}) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<RecoveryDay | null>(null);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [review, setReview] = useState(false);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<RecoveryResult[]>([]);
  useEffect(() => {
    let active = true;
    setData(null);
    setError(false);
    setSelected([]);
    setReview(false);
    setResults([]);
    getRecoveryAccounts(from, to, page).then(
      value => {
        if (active) setData(value);
      },
      () => {
        if (active) setError(true);
      },
    );
    return () => {
      active = false;
    };
  }, [from, to, page]);
  if (error) return <p role="alert">Could not load unconfirmed accounts.</p>;
  if (!data) return <p role="status">Loading unconfirmed accounts…</p>;
  const eligible = data.candidates.filter(
    row => !row.status && !results.some(result => result.key === row.key),
  );
  async function send() {
    setSending(true);
    const outcomes: RecoveryResult[] = [];
    const days = new Map<string, string[]>();
    for (const row of data!.candidates.filter(row =>
      selected.includes(row.key),
    )) {
      const date = row.created!.slice(0, 10);
      days.set(date, [...(days.get(date) || []), row.key]);
    }
    for (const [date, keys] of days) {
      try {
        outcomes.push(...(await sendRecovery(date, keys)).results);
      } catch {
        outcomes.push(
          ...keys.map(key => ({
            key,
            status: 'Outcome unavailable; inspect before retrying',
          })),
        );
      }
    }
    setResults(outcomes);
    setSelected([]);
    setReview(false);
    setSending(false);
  }
  return (
    <section aria-label="Unconfirmed accounts">
      <h4>Accounts still awaiting confirmation</h4>
      <p>
        Page {page}. Confirmations use fresh links. Accounts confirmed or
        restricted before submission are skipped. A previous recovery is shown
        below.
      </p>
      <label>
        <input
          type="checkbox"
          checked={
            !!eligible.length &&
            eligible.every(row => selected.includes(row.key))
          }
          disabled={sending || review || !eligible.length}
          onChange={event =>
            setSelected(
              event.target.checked ? eligible.map(row => row.key) : [],
            )
          }
        />{' '}
        Select all eligible accounts on this page
      </label>
      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th>Select</th>
              <th>Account</th>
              <th>Email</th>
              <th>Signed up (UTC)</th>
              <th>Recovery</th>
            </tr>
          </thead>
          <tbody>
            {data.candidates.map(row => (
              <tr key={row.key}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Select confirmation for ${row.username}`}
                    checked={selected.includes(row.key)}
                    disabled={
                      sending ||
                      review ||
                      !!row.status ||
                      results.some(result => result.key === row.key)
                    }
                    onChange={event =>
                      setSelected(old =>
                        event.target.checked
                          ? [...old, row.key]
                          : old.filter(key => key !== row.key),
                      )
                    }
                  />
                </td>
                <td>
                  <a href={`/admin/user/${encodeURIComponent(row.username)}`}>
                    @{row.username}
                  </a>
                </td>
                <td>{row.recipient}</td>
                <td>{row.created?.slice(0, 16).replace('T', ' ')}</td>
                <td>{row.status || 'Not recovered yet'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!data.candidates.length && (
        <p>No eligible unconfirmed accounts in this range.</p>
      )}
      <button
        disabled={page === 1 || sending}
        onClick={() => setPage(page - 1)}
      >
        Previous accounts
      </button>{' '}
      <button
        disabled={!data.more || sending}
        onClick={() => setPage(page + 1)}
      >
        Next accounts
      </button>{' '}
      <button
        className="btn btn-primary"
        disabled={!selected.length || sending}
        onClick={() => setReview(true)}
      >
        Review {selected.length} confirmations
      </button>
      {review && (
        <section aria-label="Review confirmations">
          <h4>Send fresh confirmation links to:</h4>
          <ul>
            {data.candidates
              .filter(row => selected.includes(row.key))
              .map(row => (
                <li key={row.key}>
                  {row.recipient} (@{row.username})
                </li>
              ))}
          </ul>
          <button className="btn btn-primary" disabled={sending} onClick={send}>
            Queue confirmation emails
          </button>{' '}
          <button disabled={sending} onClick={() => setReview(false)}>
            Cancel
          </button>
        </section>
      )}
      {!!results.length && (
        <ul role="status">
          {results.map(row => (
            <li key={row.key}>
              {
                data.candidates.find(candidate => candidate.key === row.key)
                  ?.recipient
              }
              : {row.status}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
