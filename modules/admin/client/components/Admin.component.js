import React, { useEffect, useState } from 'react';
import { getAdminDashboard } from '../api/admin-dashboard.api.js';
import AdminHeader from './AdminHeader.component.js';
import { AdminSearchUsersContent } from './AdminSearchUsers.component.js';
import UserLink from './UserLink.component.js';

const adminGroups = [
  {
    title: 'Members',
    links: [
      {
        href: '/admin/threads',
        label: 'Member threads',
        description: 'Review message threads for one member.',
      },
    ],
  },
  {
    title: 'Moderation',
    links: [
      {
        href: '/admin/messages',
        label: 'Messages',
        description: 'Read messages between two members.',
      },
      {
        href: '/admin/reference-threads',
        label: 'Reference threads',
        description: 'Check recent threads with negative references.',
      },
      {
        href: '/admin/audit-log',
        label: 'Audit log',
        description: 'Review recent admin dashboard queries.',
      },
    ],
  },
  {
    title: 'Community/admin tools',
    links: [
      {
        href: '/admin/acquisition-stories',
        label: 'Acquisition stories',
        description: 'Review member acquisition stories.',
      },
      {
        href: '/admin/acquisition-stories/analysis',
        label: 'Acquisition story analysis',
        description: 'Analyze acquisition story themes.',
      },
      {
        href: '/admin/newsletter',
        label: 'Newsletter',
        description: 'Export newsletter recipient lists.',
      },
    ],
  },
  {
    title: 'External tools',
    links: [
      {
        href: 'https://trustroots.zendesk.com/inbox/',
        label: 'Support queue',
        description: 'Open the Zendesk support inbox.',
      },
      {
        href: 'https://ideas.trustroots.org/wp-admin/',
        label: 'Blog admin',
        description: 'Manage the Trustroots ideas blog.',
      },
      {
        href: 'https://ideas.trustroots.org/wp-admin/admin.php?page=mailpoet-newsletters',
        label: 'Newsletter admin',
        description: 'Manage Mailpoet newsletters.',
      },
      {
        href: 'https://grafana.trustroots.org/',
        label: 'Statistics',
        description: 'Open Grafana statistics.',
      },
    ],
  },
];

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
    negativeReviews: [],
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
            negativeReviews: data.negativeReviews || [],
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
          <div className="col-sm-6">
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
          <div className="col-sm-6">
            <section className="panel panel-default admin-dashboard-box">
              <div className="panel-heading">
                <h2 className="panel-title">
                  <a href="/admin/reference-threads">Last 5 Negative Reviews</a>
                </h2>
              </div>
              <div className="panel-body">
                {isDashboardLoading && <p className="text-muted">Loading...</p>}
                {!isDashboardLoading &&
                  dashboard.negativeReviews.length === 0 && (
                    <p className="text-muted">No negative reviews found.</p>
                  )}
                {!isDashboardLoading && dashboard.negativeReviews.length > 0 && (
                  <table className="table table-condensed admin-dashboard-table">
                    <tbody>
                      {dashboard.negativeReviews.map(
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
        </div>

        <div className="row admin-index">
          {adminGroups.map(({ title, links }) => (
            <div className="col-sm-6" key={title}>
              <section className="panel panel-default admin-index-section">
                <div className="panel-heading">
                  <h2 className="panel-title">{title}</h2>
                </div>
                <div className="panel-body">
                  <ul className="admin-index-links">
                    {links.map(({ href, label, description }) => (
                      <li className="admin-index-link" key={href}>
                        <a href={href}>
                          <span className="admin-index-link-title">
                            {label}
                          </span>
                          <span className="admin-index-link-description">
                            {description}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

Admin.propTypes = {};
