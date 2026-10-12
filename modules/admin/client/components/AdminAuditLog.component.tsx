import React, { useEffect, useState } from 'react';

import {
  getAuditLog,
  getAuditLogActors,
  type AdminAuditLogEntry,
  type AuditActor,
  type AuditLogFilters,
} from '../api/audit-log.api';
import AdminHeader from './AdminHeader.component';
import Json from './Json.component';
import UserLink from './UserLink.component';

function auditDate(date?: string) {
  if (!date) return 'Unknown time';
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return 'Unknown time';
  return `${value.toLocaleString('en-GB', {
    timeZone: 'UTC',
    dateStyle: 'short',
    timeStyle: 'short',
  })} UTC`;
}

function requestSummary(item: AdminAuditLogEntry) {
  return (
    (['body', 'params', 'query'] as const)
      .flatMap(type => Object.entries(item[type] || {}))
      .filter(
        ([key, value]) =>
          !['page', 'limit'].includes(key) && value !== '' && value !== null,
      )
      .map(
        ([key, value]) =>
          `${key}: ${
            typeof value === 'string' ? value : JSON.stringify(value)
          }`,
      )
      .join(' · ') || '—'
  );
}

export default function AdminAuditLog() {
  const [auditLog, setAuditLog] = useState<AdminAuditLogEntry[]>([]);
  const [actors, setActors] = useState<AuditActor[]>([]);
  const [filters, setFilters] = useState<AuditLogFilters>({
    username: '',
    team: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [actorsError, setActorsError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAuditLogActors()
      .then(users => {
        if (!cancelled) setActors(users);
      })
      .catch(() => {
        if (!cancelled) setActorsError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    getAuditLog(filters)
      .then(items => {
        if (!cancelled) {
          setAuditLog(items);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setAuditLog([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [filters]);

  return (
    <>
      <AdminHeader />
      <div className="container admin-audit-log-page">
        <h2>Audit log</h2>
        <p>Latest 100 matching actions. Team filters use current membership.</p>
        <div className="admin-audit-log-filters">
          <label htmlFor="audit-actor">Performed by</label>
          <select
            id="audit-actor"
            className="form-control"
            value={filters.username}
            onChange={event =>
              setFilters({ ...filters, username: event.target.value })
            }
          >
            <option value="">All usernames</option>
            {actors.map(actor => (
              <option key={actor._id} value={actor.username}>
                {actor.username}
              </option>
            ))}
          </select>
          <label htmlFor="audit-team">Team</label>
          <select
            id="audit-team"
            className="form-control"
            value={filters.team}
            onChange={event =>
              setFilters({
                ...filters,
                team: event.target.value as AuditLogFilters['team'],
              })
            }
          >
            <option value="">All teams</option>
            <option value="admin">Admin</option>
            <option value="welcome-team">Greeters</option>
          </select>
        </div>
        {error && (
          <p role="alert">Could not load the audit log. Please try again.</p>
        )}
        {actorsError && (
          <p role="alert">Could not load the staff list. Please try again.</p>
        )}
        {loading ? (
          <p role="status">Loading audit log...</p>
        ) : error ? null : auditLog.length ? (
          <div className="table-responsive">
            <table className="table table-condensed table-striped admin-audit-log-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Performed by</th>
                  <th>Request</th>
                  <th>Summary</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLog.map(item => (
                  <tr key={item._id}>
                    <td>
                      <time dateTime={item.date}>{auditDate(item.date)}</time>
                    </td>
                    <td>
                      <UserLink user={item.user || {}} />
                    </td>
                    <td>
                      {item.route ? (
                        <samp>{item.route}</samp>
                      ) : (
                        <em>Unknown route</em>
                      )}
                    </td>
                    <td>
                      <div className="admin-audit-log-summary">
                        {requestSummary(item)}
                      </div>
                    </td>
                    <td>
                      <details>
                        <summary>Show details</summary>
                        <p>IP: {item.ip || 'Unknown IP address'}</p>
                        <p>
                          Audit log ID: <samp>{item._id}</samp>
                        </p>
                        {(['body', 'params', 'query'] as const).map(
                          type =>
                            item[type] && (
                              <div key={type}>
                                <h5>{type}</h5>
                                <Json content={item[type] as object} />
                              </div>
                            ),
                        )}
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>Nothing found...</p>
        )}
      </div>
    </>
  );
}
