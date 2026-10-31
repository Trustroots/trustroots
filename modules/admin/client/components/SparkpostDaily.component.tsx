import React, { useEffect, useState } from 'react';
import {
  getSparkpostEvents,
  getRecoveryDay,
  sendRecovery,
} from '../api/sparkpost.api';
import type {
  SparkpostEvents,
  RecoveryDay,
  RecoveryResult,
} from '../../shared/sparkpost';

export default function SparkpostDaily({ date }: { date: string }) {
  const [events, setEvents] = useState<SparkpostEvents['events']>([]);
  const [cursor, setCursor] = useState('');
  const [next, setNext] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [providerError, setProviderError] = useState(false);
  const [partial, setPartial] = useState(false);
  const [page, setPage] = useState(1);
  const [day, setDay] = useState<RecoveryDay | null>(null);
  const [candidateError, setCandidateError] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [review, setReview] = useState(false);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<RecoveryResult[]>([]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setProviderError(false);
    getSparkpostEvents(date, cursor).then(
      data => {
        if (!active) return;
        setEvents(previous =>
          cursor ? [...previous, ...data.events] : data.events,
        );
        setNext(data.nextCursor);
        setPartial(data.capped);
        setLoading(false);
      },
      () => {
        if (active) {
          setProviderError(true);
          setLoading(false);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [date, cursor]);
  useEffect(() => {
    let active = true;
    setDay(null);
    setSelected([]);
    setReview(false);
    setResults([]);
    setCandidateError(false);
    getRecoveryDay(date, page).then(
      data => {
        if (active) setDay(data);
      },
      () => {
        if (active) setCandidateError(true);
      },
    );
    return () => {
      active = false;
    };
  }, [date, page]);
  const groups = new Map<
    string,
    { event: SparkpostEvents['events'][number]; types: Set<string> }
  >();
  events.forEach((event, index) => {
    const key = event.messageId
      ? event.messageId + ':' + event.recipient
      : `unlinked:${index}`;
    const group = groups.get(key);
    if (group) group.types.add(event.type);
    else groups.set(key, { event, types: new Set([event.type]) });
  });
  const eligible =
    day?.candidates.filter(
      row => !row.status && !results.some(result => result.key === row.key),
    ) || [];
  async function send() {
    setSending(true);
    try {
      const response = await sendRecovery(date, selected);
      setResults(response.results);
      setReview(false);
      setSelected([]);
    } catch {
      setResults(
        selected.map(key => ({
          key,
          status: 'Outcome unavailable. Refresh and inspect before retrying.',
        })),
      );
      setReview(false);
    } finally {
      setSending(false);
    }
  }
  return (
    <section aria-label="Daily emails">
      <h3>Emails and recovery: {date} (UTC)</h3>
      <h4>Provider email activity</h4>
      <p>
        All available event types, 100 events per page. Delivery and injection
        show sending activity; opens and clicks may concern emails sent earlier.
        Load more until the day is complete. Events for the same provider
        message and recipient are grouped as pages load. Data is retained for 10
        days; an absent event does not prove non-delivery.
      </p>
      {providerError && (
        <p role="alert">Could not load provider events. Retry this day.</p>
      )}
      {partial && (
        <p role="alert">
          Provider pagination was incomplete. These results may omit events.
        </p>
      )}
      {!!events.length && (
        <div className="table-responsive">
          <table className="table table-striped">
            <caption>Provider emails for this day</caption>
            <thead>
              <tr>
                <th>Time (UTC)</th>
                <th>Subject</th>
                <th>Recipient</th>
                <th>Campaign</th>
                <th>Events seen</th>
                <th>Account match</th>
              </tr>
            </thead>
            <tbody>
              {[...groups].map(([key, { event, types }]) => (
                <tr key={key}>
                  <td>{event.timestamp.slice(0, 16).replace('T', ' ')}</td>
                  <td>{event.subject || 'Not supplied'}</td>
                  <td>
                    {event.recipient || event.recipientDomain || 'Not supplied'}
                  </td>
                  <td>{event.campaign || 'Unknown'}</td>
                  <td>{[...types].join(', ')}</td>
                  <td>
                    {event.account ? (
                      <>
                        <a
                          href={`/admin/user/${encodeURIComponent(event.account.username)}`}
                        >
                          @{event.account.username}
                        </a>
                        <br />
                        Signed up {event.account.created.slice(0, 10)};{' '}
                        {event.account.public ? 'confirmed' : 'unconfirmed'}
                      </>
                    ) : (
                      'No unique current account match'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p>
        Account matches use the current email address. They do not identify a
        particular private message. Subject and campaign describe the email; the
        email body is not available here.
      </p>
      {loading ? (
        <p role="status">Loading provider events…</p>
      ) : next ? (
        <button className="btn btn-default" onClick={() => setCursor(next)}>
          Load more events
        </button>
      ) : (
        !providerError &&
        !partial && (
          <p>
            {events.length} events loaded. All available events for this day
            have been retrieved.
          </p>
        )
      )}
      <h4>Application events eligible for recovery</h4>
      <p>
        New unconfirmed sign-ups and still-unread conversations with activity on
        this day. These are candidates, not proof of missed delivery. Selecting
        an item requests a fresh email, even if a previous email was delivered.
        Read, replied, blocked and restricted conversations are excluded.
      </p>
      {candidateError ? (
        <p role="alert">Could not load recovery candidates.</p>
      ) : !day ? (
        <p role="status">Loading application events…</p>
      ) : (
        <>
          <label>
            <input
              type="checkbox"
              disabled={sending || review || !eligible.length}
              checked={
                !!eligible.length &&
                eligible.every(row => selected.includes(row.key))
              }
              onChange={event =>
                setSelected(
                  event.target.checked ? eligible.map(row => row.key) : [],
                )
              }
            />{' '}
            Select all eligible events on this page
          </label>
          <table className="table">
            <caption>Recovery candidates, page {page}</caption>
            <thead>
              <tr>
                <th>Select</th>
                <th>Recipient</th>
                <th>Fresh email</th>
                <th>Previous recovery</th>
              </tr>
            </thead>
            <tbody>
              {day.candidates.map(row => (
                <tr key={row.key}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Select ${row.description} for ${row.username}`}
                      disabled={
                        sending ||
                        review ||
                        !!row.status ||
                        results.some(result => result.key === row.key)
                      }
                      checked={selected.includes(row.key)}
                      onChange={event =>
                        setSelected(previous =>
                          event.target.checked
                            ? [...previous, row.key]
                            : previous.filter(key => key !== row.key),
                        )
                      }
                    />
                  </td>
                  <td>
                    <a href={`/admin/user/${encodeURIComponent(row.username)}`}>
                      @{row.username}
                    </a>
                    <br />
                    {row.recipient}
                  </td>
                  <td>{row.description}</td>
                  <td>{row.status || 'No previous recovery recorded'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!day.candidates.length && (
            <p>No eligible application events on this page.</p>
          )}
          <button
            className="btn btn-default"
            disabled={page === 1 || sending}
            onClick={() => setPage(page - 1)}
          >
            Previous candidates
          </button>{' '}
          <button
            className="btn btn-default"
            disabled={!day.more || sending}
            onClick={() => setPage(page + 1)}
          >
            Next candidates
          </button>{' '}
          <button
            className="btn btn-primary"
            disabled={!selected.length || sending}
            onClick={() => setReview(true)}
          >
            Review {selected.length} selected emails
          </button>
        </>
      )}
      {review && (
        <section aria-label="Review recovery emails">
          <h4>Review before sending</h4>
          <ul>
            {day?.candidates
              .filter(row => selected.includes(row.key))
              .map(row => (
                <li key={row.key}>
                  {row.description} → {row.recipient}
                </li>
              ))}
          </ul>
          <p>
            Confirmation links will be renewed. Current eligibility is checked
            again. Queued emails will be sent by the worker.
          </p>
          <button disabled={sending} className="btn btn-primary" onClick={send}>
            Queue selected emails
          </button>{' '}
          <button disabled={sending} onClick={() => setReview(false)}>
            Cancel
          </button>
        </section>
      )}
      {!!results.length && (
        <section role="status">
          <h4>Recovery results</h4>
          <ul>
            {results.map(result => (
              <li key={result.key}>
                {day?.candidates.find(row => row.key === result.key)
                  ?.recipient || result.key}
                : {result.status}
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
