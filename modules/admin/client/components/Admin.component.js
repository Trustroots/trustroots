import React from 'react';
import AdminHeader from './AdminHeader.component.js';
import { AdminSearchUsersContent } from './AdminSearchUsers.component.js';

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

export default function Admin() {
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
