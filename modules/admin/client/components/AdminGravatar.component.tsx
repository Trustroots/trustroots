import React, { useEffect, useState } from 'react';
import { Button } from '@trustroots/ui/Button';
import {
  gravatarSortColumns,
  type GravatarSort,
} from '../../shared/gravatar.mts';
import { getGravatarUsage, type GravatarUsage } from '../api/gravatar.api';
import {
  formatAdminDateTime,
  getAdminDateTimeAttribute,
} from '../utils/admin-date';
import AdminGravatarPhotoCheck from './AdminGravatarPhotoCheck';
import AdminHeader from './AdminHeader.component';

const columnLabels: Record<GravatarSort['column'], string> = {
  username: 'Username',
  displayName: 'Display name',
  seen: 'Last seen (UTC)',
};

interface MemberQuery {
  page: number;
  sort?: GravatarSort;
}

export default function AdminGravatar() {
  const [query, setQuery] = useState<MemberQuery>({ page: 1 });
  const [loaded, setLoaded] = useState<{
    query: MemberQuery;
    usage: GravatarUsage;
  } | null>(null);
  const [failed, setFailed] = useState(false);
  const usage = loaded?.usage;
  const appliedSort = loaded?.query.sort;
  const loading = loaded?.query !== query;

  useEffect(() => {
    let active = true;
    setFailed(false);
    getGravatarUsage(query.page, query.sort)
      .then(usage => {
        if (active) setLoaded({ query, usage });
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [query]);

  function changeSort(column: GravatarSort['column']) {
    setQuery(current => ({
      page: 1,
      sort: {
        column,
        direction:
          current.sort?.column === column
            ? current.sort.direction === 'ascending'
              ? 'descending'
              : 'ascending'
            : column === 'seen'
              ? 'descending'
              : 'ascending',
      },
    }));
  }

  return (
    <>
      <AdminHeader />
      <div className="container">
        <h2>Gravatar usage</h2>
        <p>
          Gravatar used to be the default avatar setting. Accounts without a
          Gravatar image may display a placeholder.
        </p>
        <AdminGravatarPhotoCheck />
        {failed && <p role="alert">Could not load Gravatar usage.</p>}
        {loading && !failed && <p role="status">Loading Gravatar usage…</p>}
        {usage && !failed && (
          <>
            <p>
              <strong>{usage.accounts}</strong> accounts have Gravatar set as
              their avatar source.
            </p>
            <p>
              Measured at{' '}
              <time dateTime={usage.measuredAt}>
                {formatAdminDateTime(usage.measuredAt)}
              </time>{' '}
              UTC.
            </p>
            {usage.members.length === 0 ? (
              <p>No Gravatar members on this page.</p>
            ) : (
              <table
                aria-busy={loading}
                className="table table-striped"
                aria-label="Gravatar members"
              >
                <thead>
                  <tr>
                    {gravatarSortColumns.map(column => {
                      const direction =
                        appliedSort?.column === column
                          ? appliedSort.direction
                          : undefined;
                      return (
                        <th key={column} scope="col" aria-sort={direction}>
                          <Button
                            variant="link"
                            type="button"
                            onClick={() => changeSort(column)}
                          >
                            {columnLabels[column]}
                            {direction && (
                              <span aria-hidden="true">
                                {direction === 'ascending' ? ' ▲' : ' ▼'}
                              </span>
                            )}
                          </Button>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {usage.members.map(member => (
                    <tr key={member._id}>
                      <td>
                        <a href={`/admin/user/${member.username}`}>
                          <img
                            alt=""
                            className="avatar avatar-32"
                            width={32}
                            height={32}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            src={`/api/users/${member._id}/avatar?size=32`}
                          />{' '}
                          {member.username}
                        </a>
                      </td>
                      <td>{member.displayName}</td>
                      <td>
                        {getAdminDateTimeAttribute(member.seen) ? (
                          <time dateTime={member.seen}>
                            {formatAdminDateTime(member.seen)}
                          </time>
                        ) : (
                          'Unknown'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <nav aria-label="Gravatar member pages">
              <Button
                disabled={loading || usage.page === 1}
                onClick={() => setQuery({ ...query, page: usage.page - 1 })}
              >
                Previous
              </Button>
              <span> Page {usage.page} </span>
              <Button
                disabled={loading || !usage.hasNextPage}
                onClick={() => setQuery({ ...query, page: usage.page + 1 })}
              >
                Next
              </Button>
            </nav>
          </>
        )}
      </div>
    </>
  );
}
