import React, { useCallback, useEffect, useState } from 'react';
import AdminHeader from './AdminHeader.component';
import {
  getSparkpostOverview,
  getSparkpostEvents,
  getSparkpostPreview,
} from '../api/sparkpost.api';

function formatDateTime(value: string) {
  return value.slice(0, 16).replace('T', ' ');
}

function parseDateTime(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value)) return null;
  const time = Date.parse(value.replace(' ', 'T') + ':00.000Z');
  return Number.isFinite(time) &&
    formatDateTime(new Date(time).toISOString()) === value
    ? time
    : null;
}

function useResult<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    setData(null);
    setError(false);
    load().then(
      result => {
        if (active) setData(result);
      },
      () => {
        if (active) setError(true);
      },
    );
    return () => {
      active = false;
    };
  }, [load]);
  return { data, error };
}

function Events({ date }: { date: string }) {
  const load = useCallback(() => getSparkpostEvents(date), [date]);
  const { data, error } = useResult(load);
  return (
    <section aria-label="Provider events">
      <h3>Provider events: {date} (UTC)</h3>
      <p>
        Up to 500 events from the last 10 days. Missing events do not prove
        non-delivery. Only recipient domains are shown.
      </p>
      {error ? (
        <p role="alert">
          Could not load events. Check the date, provider access and retention
          period.
        </p>
      ) : !data ? (
        <p role="status">Loading events…</p>
      ) : (
        <>
          {data.capped && (
            <p className="alert alert-warning">
              Partial results: the event sample is capped or pagination could
              not be completed.
            </p>
          )}
          {!data.events.length ? (
            <p>No events returned for this day.</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped">
                <caption>Sample of provider events</caption>
                <thead>
                  <tr>
                    <th>Time (UTC)</th>
                    <th>Event</th>
                    <th>Campaign</th>
                    <th>Recipient domain</th>
                  </tr>
                </thead>
                <tbody>
                  {data.events.map((event, index) => (
                    <tr key={index}>
                      <td>{event.timestamp}</td>
                      <td>{event.type}</td>
                      <td>{event.campaign || 'Unknown'}</td>
                      <td>{event.recipientDomain || 'Unknown'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Preview({ window }: { window: { from: string; to: string } }) {
  const load = useCallback(
    () => getSparkpostPreview(window.from, window.to),
    [window],
  );
  const { data, error } = useResult(load);
  if (error)
    return (
      <p role="alert">
        Could not load the preview. The server could not read the diagnostic
        data. Please try again.
      </p>
    );
  if (!data) return <p role="status">Loading preview…</p>;
  return (
    <section aria-label="Outage preview results">
      <h4>What we found</h4>
      <p>
        {formatDateTime(data.from)} to {formatDateTime(data.to)} UTC. The start
        is included; the end is excluded.
      </p>
      <div className="alert alert-info">
        <strong>Delivery unverified.</strong> This report cannot tell us how
        many emails were missed. It compares account status and stored job
        records, without checking individual deliveries with SparkPost.
      </div>
      <div className="table-responsive">
        <table className="table">
          <caption>Two separate counts for the selected period</caption>
          <thead>
            <tr>
              <th>What was counted</th>
              <th>Count</th>
              <th>What it means</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">New accounts awaiting confirmation</th>
              <td>
                <strong>{data.awaitingConfirmation}</strong>
              </td>
              <td>
                Created during this period and still unconfirmed. Some members
                may have received an email but not confirmed it. Suspended and
                shadowbanned accounts are excluded.
              </td>
            </tr>
            <tr>
              <th scope="row">Email-job records marked complete</th>
              <td>
                <strong>{data.jobsInspected}</strong>
              </td>
              <td>
                Saved records of email tasks completed during this period,
                including notifications to existing members. A task could be
                marked complete even while sending was disabled.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {data.capped && (
        <p className="alert alert-warning">
          Partial preview: only the first 1,000 completed jobs are included.
          Narrow the time window.
        </p>
      )}
      <p>
        To recover confirmations, we will need to identify affected accounts and
        generate fresh links. This page does not resend anything.
      </p>
      {!data.campaigns.length ? (
        <p className="alert alert-warning">
          No stored email-job records were found for this period. This does not
          mean zero emails were sent or missed: records may have been removed or
          may not match the search. The unconfirmed-account count above comes
          from user profiles and is independent of these records.
        </p>
      ) : (
        <table className="table table-striped">
          <caption>Completed jobs by campaign (delivery unverified)</caption>
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Jobs</th>
            </tr>
          </thead>
          <tbody>
            {data.campaigns.map(row => (
              <tr key={row.campaign}>
                <td>{row.campaign}</td>
                <td>{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default function AdminSparkpost() {
  const [days, setDays] = useState('30');
  const [date, setDate] = useState('');
  const [from, setFrom] = useState('2026-10-28 07:30');
  const [to, setTo] = useState('2026-10-31 12:00');
  const [inputError, setInputError] = useState('');
  const [adjusted, setAdjusted] = useState(false);
  const [window, setWindow] = useState<{ from: string; to: string } | null>(
    null,
  );
  const load = useCallback(() => getSparkpostOverview(days), [days]);
  const { data, error } = useResult(load);
  return (
    <>
      <AdminHeader />
      <main className="container">
        <h2>SparkPost email diagnostics</h2>
        <p>
          Read-only diagnostics. No emails are sent or jobs replayed from this
          page.
        </p>
        <label htmlFor="sparkpost-period">Reporting period</label>{' '}
        <select
          id="sparkpost-period"
          value={days}
          onChange={event => {
            setDays(event.target.value);
            setDate('');
          }}
        >
          <option value="7">7 days</option>
          <option value="30">30 days</option>
          <option value="90">90 days</option>
        </select>
        <p>
          All dates are UTC. Sign-ups and private-message counts come from the
          current application database. Today is incomplete. Provider metrics
          cover the configured SparkPost account; they are not a one-to-one
          match with application activity.
        </p>
        {error ? (
          <p role="alert">
            Could not load email diagnostics. Change the period to try again.
          </p>
        ) : !data ? (
          <p role="status">Loading email diagnostics…</p>
        ) : (
          <>
            {data.provider !== 'ready' && (
              <p className="alert alert-warning">
                {data.provider === 'disabled'
                  ? 'SparkPost is not configured. Set SPARKPOST_API_KEY on the server to enable provider metrics.'
                  : 'SparkPost metrics are unavailable. Check provider access and configuration.'}
              </p>
            )}
            <div className="table-responsive">
              <table className="table table-striped">
                <caption>
                  Daily application activity and SparkPost delivery; — means
                  unavailable
                </caption>
                <thead>
                  <tr>
                    <th>Date (UTC)</th>
                    <th>Sign-ups</th>
                    <th>Private messages</th>
                    <th>SP sent</th>
                    <th>SP delivered</th>
                    <th>SP bounced</th>
                    <th>SP unique opens</th>
                    <th>SP complaints</th>
                    <th>Events</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map(row => (
                    <tr key={row.date}>
                      <td>{row.date}</td>
                      <td>{row.signups}</td>
                      <td>{row.messages}</td>
                      {[
                        row.sent,
                        row.delivered,
                        row.bounced,
                        row.opens,
                        row.complaints,
                      ].map((count, index) => (
                        <td key={index}>{count ?? '—'}</td>
                      ))}
                      <td>
                        {data.provider === 'ready' &&
                        Date.parse(row.date) >= Date.now() - 10 * 86400000 ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-default"
                            onClick={() => setDate(row.date)}
                            aria-label={`Inspect events for ${row.date}`}
                          >
                            Inspect
                          </button>
                        ) : (
                          'Unavailable'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {date && <Events key={date} date={date} />}
        <hr />
        <h3>Preview a sending interruption</h3>
        <p>
          The suggested window covers the reported October 2026 interruption.
          Adjust it to the confirmed capture window. These inputs are UTC,
          regardless of your browser time zone. Nothing is sent or changed.
        </p>
        <p id="sparkpost-date-format">
          Use yyyy-mm-dd hh:mm (24-hour UTC). Future dates are changed to now.
          Maximum period: 31 days.
        </p>
        <form
          onSubmit={event => {
            event.preventDefault();
            setInputError('');
            setAdjusted(false);
            setWindow(null);
            const start = parseDateTime(from);
            const end = parseDateTime(to);
            if (start === null || end === null) {
              setInputError(
                'Enter valid dates as yyyy-mm-dd hh:mm, using the 24-hour clock (UTC).',
              );
              return;
            }
            const now = Date.now();
            const clampedStart = Math.min(start, now);
            const clampedEnd = Math.min(end, now);
            const fromIso = new Date(clampedStart).toISOString();
            const toIso = new Date(clampedEnd).toISOString();
            setFrom(formatDateTime(fromIso));
            setTo(formatDateTime(toIso));
            setAdjusted(start > now || end > now);
            if (clampedStart >= clampedEnd) {
              setInputError('The start must be earlier than the end.');
              return;
            }
            if (clampedEnd - clampedStart > 31 * 86400000) {
              setInputError('Choose a period of 31 days or less.');
              return;
            }
            setWindow({ from: fromIso, to: toIso });
          }}
        >
          <div className="form-group">
            <label htmlFor="sparkpost-from">From (UTC, inclusive)</label>
            <input
              className="form-control"
              id="sparkpost-from"
              type="text"
              placeholder="yyyy-mm-dd hh:mm"
              aria-describedby="sparkpost-date-format"
              required
              value={from}
              onChange={event => setFrom(event.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="sparkpost-to">To (UTC, exclusive)</label>
            <input
              className="form-control"
              id="sparkpost-to"
              type="text"
              placeholder="yyyy-mm-dd hh:mm"
              aria-describedby="sparkpost-date-format"
              required
              value={to}
              onChange={event => setTo(event.target.value)}
            />
          </div>
          <button className="btn btn-primary" type="submit">
            Preview completed jobs
          </button>
        </form>
        {adjusted && (
          <p role="status">
            Future dates were changed to the current time (UTC).
          </p>
        )}
        {inputError && <p role="alert">{inputError}</p>}
        {window && <Preview key={JSON.stringify(window)} window={window} />}
      </main>
    </>
  );
}
