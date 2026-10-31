import React, { useCallback, useEffect, useState } from 'react';
import AdminHeader from './AdminHeader.component';
import {
  getSparkpostOverview,
  getSparkpostEvents,
  getSparkpostPreview,
} from '../api/sparkpost.api';

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
        Could not load the preview. Check the UTC window (at most 31 days,
        ending no later than now) and try again.
      </p>
    );
  if (!data) return <p role="status">Loading preview…</p>;
  return (
    <section aria-label="Outage preview results">
      <p>
        <strong>Delivery unverified.</strong> Completed jobs may include
        delivered emails. This preview does not match individual jobs against
        SparkPost records.
      </p>
      <p>
        Window: {data.from} (inclusive) to {data.to} (exclusive).
      </p>
      <p>
        <strong>{data.awaitingConfirmation}</strong> accounts created in this
        window still await confirmation, excluding suspended and shadowbanned
        accounts. This is a candidate count, not a count of missing emails.
      </p>
      <p>
        {data.jobsInspected} completed email jobs inspected. These jobs may
        concern accounts created before the window.
      </p>
      {data.capped && (
        <p className="alert alert-warning">
          Partial preview: only the first 1,000 completed jobs are included.
          Narrow the time window.
        </p>
      )}
      <p>
        Older jobs may have been removed. Reminder counts may have advanced
        without delivery. Confirmation recovery will require fresh links.
      </p>
      {!data.campaigns.length ? (
        <p>No completed email jobs found in this window.</p>
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
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
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
          Choose the confirmed capture window. These inputs are UTC, regardless
          of your browser time zone. Nothing is sent or changed.
        </p>
        <form
          onSubmit={event => {
            event.preventDefault();
            setWindow({
              from: new Date(from + 'Z').toISOString(),
              to: new Date(to + 'Z').toISOString(),
            });
          }}
        >
          <div className="form-group">
            <label htmlFor="sparkpost-from">From (UTC, inclusive)</label>
            <input
              className="form-control"
              id="sparkpost-from"
              type="datetime-local"
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
              type="datetime-local"
              required
              value={to}
              onChange={event => setTo(event.target.value)}
            />
          </div>
          <button className="btn btn-primary" type="submit">
            Preview completed jobs
          </button>
        </form>
        {window && <Preview key={JSON.stringify(window)} window={window} />}
      </main>
    </>
  );
}
