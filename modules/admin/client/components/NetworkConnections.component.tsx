import React, { useEffect, useState } from 'react';
import {
  connectionUrl,
  NETWORKS,
  parseConnectionSearch,
  type Network,
} from '../../../users/shared/network-connections.js';
import * as api from '../api/network-connections.api';
import { formatAdminDateTime } from '../utils/admin-date';
import UserLink from './UserLink.component';

function identifierLink(network: Network, identifier: string) {
  const url = connectionUrl(network, identifier);
  return url ? (
    <a href={url} target="_blank" rel="noreferrer">
      {identifier}
    </a>
  ) : (
    identifier
  );
}

export function NetworkConnectionsPanel({ memberId }: { memberId: string }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Awaited<
    ReturnType<typeof api.getMemberNetworkConnections>
  > | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setData(null);
    setFailed(false);
    api
      .getMemberNetworkConnections(memberId, page)
      .then(value => {
        if (active) setData(value);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [memberId, page]);

  return (
    <section
      className="panel panel-default"
      aria-labelledby="network-connections-title"
    >
      <div className="panel-body">
        <h4 id="network-connections-title">External connection history</h4>
        {failed ? (
          <p role="alert">Unable to load connection history.</p>
        ) : !data ? (
          <p role="status">Loading connection history…</p>
        ) : (
          <>
            <h5>Current connections</h5>
            {data.current.length === 0 ? (
              <p>No current external connections.</p>
            ) : (
              <ul>
                {data.current.map(({ network, identifier }) => {
                  const networkInfo = NETWORKS.find(
                    item => item.id === network,
                  );
                  return (
                    <li key={`${network}:${identifier}`}>
                      {networkInfo?.label || network}:{' '}
                      {identifierLink(network, identifier)}
                    </li>
                  );
                })}
              </ul>
            )}
            <h5>Changes</h5>
            {data.history.length === 0 ? (
              <p>No connection history.</p>
            ) : (
              <table
                className="table table-condensed table-striped"
                aria-label="External connection changes"
              >
                <thead>
                  <tr>
                    <th>Network</th>
                    <th>Previous</th>
                    <th>New</th>
                    <th>Changed at</th>
                  </tr>
                </thead>
                <tbody>
                  {data.history.map((item, index) => {
                    const networkInfo = NETWORKS.find(
                      network => network.id === item.network,
                    );
                    return (
                      <tr
                        key={`${item.network}:${item.changedAt || 'initial'}:${index}`}
                      >
                        <th scope="row">
                          {networkInfo?.label || item.network}
                        </th>
                        <td>
                          {item.oldIdentifier
                            ? identifierLink(item.network, item.oldIdentifier)
                            : '—'}
                        </td>
                        <td>
                          {item.newIdentifier
                            ? identifierLink(item.network, item.newIdentifier)
                            : 'Removed'}
                        </td>
                        <td>
                          {item.initial ? (
                            'Unknown (initial snapshot)'
                          ) : item.changedAt ? (
                            <time dateTime={item.changedAt}>
                              {formatAdminDateTime(item.changedAt)}
                            </time>
                          ) : (
                            'Unknown'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            <div aria-label="Connection history pagination">
              <button
                type="button"
                className="btn btn-default"
                disabled={page <= 1}
                onClick={() => setPage(value => value - 1)}
              >
                Previous
              </button>{' '}
              <span>Page {data.page}</span>{' '}
              <button
                type="button"
                className="btn btn-default"
                disabled={!data.hasNextPage}
                onClick={() => setPage(value => value + 1)}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export function NetworkConnectionSearchPage() {
  const [network, setNetwork] = useState<Network>(NETWORKS[0].id);
  const [identifier, setIdentifier] = useState('');
  const [submitted, setSubmitted] = useState<{
    network: Network;
    identifier: string;
  } | null>(null);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Awaited<
    ReturnType<typeof api.searchNetworkConnections>
  > | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [validationError, setValidationError] = useState(false);

  useEffect(() => {
    if (!submitted) return;
    let active = true;
    setPending(true);
    setFailed(false);
    setData(null);
    api
      .searchNetworkConnections(submitted.network, submitted.identifier, page)
      .then(value => {
        if (active) setData(value);
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (active) setPending(false);
      });
    return () => {
      active = false;
    };
  }, [submitted, page]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedIdentifier = parseConnectionSearch(network, identifier);
    if (!parsedIdentifier) {
      setValidationError(true);
      setSubmitted(null);
      setData(null);
      return;
    }
    setValidationError(false);
    setPage(1);
    setSubmitted({ network, identifier: parsedIdentifier });
  }

  return (
    <main className="container">
      <h1>Search external connections</h1>
      <form onSubmit={submit}>
        <div className="form-group">
          <label htmlFor="connection-network">Network</label>
          <select
            className="form-control"
            id="connection-network"
            value={network}
            onChange={event => setNetwork(event.target.value as Network)}
          >
            {NETWORKS.map(item => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="connection-identifier">Identifier</label>
          <input
            className="form-control"
            id="connection-identifier"
            value={identifier}
            required
            maxLength={2048}
            onChange={event => setIdentifier(event.target.value)}
          />
        </div>
        <button
          className="btn btn-primary"
          type="submit"
          disabled={pending || !identifier.trim()}
        >
          Search
        </button>
      </form>
      {validationError && (
        <p role="alert">
          Enter a valid identifier or profile URL for this network.
        </p>
      )}
      {pending && <p role="status">Searching…</p>}
      {failed && <p role="alert">Unable to search external connections.</p>}
      {data && data.members.length === 0 && <p>No matching members.</p>}
      {data && data.members.length > 0 && (
        <>
          <ul aria-label="Members with this connection">
            {data.members.map(member => (
              <li key={`${member._id}:${member.identifier}`}>
                <UserLink user={member} />{' '}
                {identifierLink(submitted!.network, member.identifier)}{' '}
                <span>{member.current ? 'Current' : 'Previous'}</span>
              </li>
            ))}
          </ul>
          <div aria-label="Search results pagination">
            <button
              className="btn btn-default"
              disabled={page <= 1}
              onClick={() => setPage(value => value - 1)}
            >
              Previous
            </button>{' '}
            <span>Page {data.page}</span>{' '}
            <button
              className="btn btn-default"
              disabled={!data.hasNextPage}
              onClick={() => setPage(value => value + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </main>
  );
}
