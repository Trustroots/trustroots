import React, { useEffect, useState } from 'react';
import { getAdminDashboard } from '../api/admin-dashboard.api.js';
import AdminHeader from './AdminHeader.component.js';
import { AdminSearchUsersContent } from './AdminSearchUsers.component.js';
import UserLink from './UserLink.component.js';

function formatDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function adminMessagesUrl(userFrom, userTo) {
  if (!userFrom || !userFrom._id || !userTo || !userTo._id) {
    return null;
  }

  return `/admin/messages?userId1=${userFrom._id}&userId2=${userTo._id}`;
}

export default function Admin() {
  const [dashboard, setDashboard] = useState({
    negativeExperiences: [],
    threadVotes: [],
    topMessengers: [],
  });
  const [isDashboardLoading, setIsDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      try {
        const data = await getAdminDashboard();

        if (isMounted) {
          setDashboard({
            negativeExperiences: data.negativeExperiences || [],
            threadVotes: data.threadVotes || [],
            topMessengers: data.topMessengers || [],
          });
          setDashboardError(null);
        }
      } catch (error) {
        if (isMounted) {
          setDashboardError('Could not load dashboard activity.');
        }
      } finally {
        if (isMounted) {
          setIsDashboardLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <>
      <AdminHeader />
      <div className="container admin-landing">
        <header className="admin-landing__hero">
          <h1 className="admin-landing__title">Admin Dashboard</h1>
          <p className="admin-landing__subtitle">
            Search members and jump directly to moderation, messaging and
            community tools.
          </p>
        </header>

        <div className="admin-landing__search">
          <AdminSearchUsersContent showHeading={false} />
        </div>

        <div className="row admin-dashboard-boxes">
          {dashboardError && (
            <div className="col-sm-12">
              <p className="text-danger">{dashboardError}</p>
            </div>
          )}
          <div className="col-sm-4">
            <section className="panel panel-default admin-dashboard-box">
              <div className="panel-heading">
                <h2 className="panel-title">Top 10 Messengers Last Week</h2>
              </div>
              <div className="panel-body">
                {isDashboardLoading && <p className="text-muted">Loading...</p>}
                {!isDashboardLoading &&
                  dashboard.topMessengers.length === 0 && (
                    <p className="text-muted">No messages last week.</p>
                  )}
                {!isDashboardLoading && dashboard.topMessengers.length > 0 && (
                  <table className="table table-condensed admin-dashboard-table">
                    <tbody>
                      {dashboard.topMessengers.map(
                        ({ messageCount, user }, index) => (
                          <tr
                            key={user && user._id ? user._id : `row-${index}`}
                          >
                            <td>
                              <UserLink user={user || {}} />
                            </td>
                            <td className="text-right">
                              {messageCount} messages
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </div>
          <div className="col-sm-4">
            <section className="panel panel-default admin-dashboard-box">
              <div className="panel-heading">
                <h2 className="panel-title">
                  <a href="/admin/reference-threads">
                    Last 10 Negative Thread Votes
                  </a>
                </h2>
              </div>
              <div className="panel-body">
                {isDashboardLoading && <p className="text-muted">Loading...</p>}
                {!isDashboardLoading && dashboard.threadVotes.length === 0 && (
                  <p className="text-muted">No negative thread votes found.</p>
                )}
                {!isDashboardLoading && dashboard.threadVotes.length > 0 && (
                  <table className="table table-condensed admin-dashboard-table">
                    <tbody>
                      {dashboard.threadVotes.map(
                        ({ _id, created, thread, userFrom, userTo }) => {
                          const messagesUrl = adminMessagesUrl(
                            userFrom,
                            userTo,
                          );

                          return (
                            <tr key={_id}>
                              <td>
                                <UserLink user={userFrom || {}} />
                                {' -> '}
                                <UserLink user={userTo || {}} />
                              </td>
                              <td className="text-right">
                                {messagesUrl ? (
                                  <a href={messagesUrl}>
                                    {formatDate(created) || thread}
                                  </a>
                                ) : (
                                  formatDate(created) || thread
                                )}
                              </td>
                            </tr>
                          );
                        },
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </div>
          <div className="col-sm-4">
            <section className="panel panel-default admin-dashboard-box">
              <div className="panel-heading">
                <h2 className="panel-title">Last 10 Negative Experiences</h2>
              </div>
              <div className="panel-body">
                {isDashboardLoading && <p className="text-muted">Loading...</p>}
                {!isDashboardLoading &&
                  dashboard.negativeExperiences.length === 0 && (
                    <p className="text-muted">No negative experiences found.</p>
                  )}
                {!isDashboardLoading &&
                  dashboard.negativeExperiences.length > 0 && (
                    <table className="table table-condensed admin-dashboard-table">
                      <tbody>
                        {dashboard.negativeExperiences.map(
                          ({ _id, created, userFrom, userTo }) => (
                            <tr key={_id}>
                              <td>
                                <UserLink user={userFrom || {}} />
                                {' -> '}
                                <UserLink user={userTo || {}} />
                              </td>
                              <td className="text-right">
                                {formatDate(created) || 'Unknown date'}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

Admin.propTypes = {};
