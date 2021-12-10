// External dependencies
import classnames from 'classnames';
import React from 'react';

// Internal dependencies
import adminIcon from '../images/bmo.png';

export default function AdminHeader() {
  const currentPath = window.location.pathname.replace('/admin/', '');

  const pages = [
    {
      path: 'user',
      label: 'Member report card',
    },
    {
      path: 'search-users',
      label: 'Search members',
    },
    {
      path: 'messages',
      label: 'Messages',
    },
    {
      path: 'threads',
      label: 'Threads',
    },
    {
      path: 'reference-threads',
      label: 'Reference threads',
    },
    {
      path: 'acquisition-stories',
      label: 'Acquisition stories',
    },
    {
      path: 'newsletter',
      label: 'Newsletter',
    },
  ];

  const renderTab = ({ path, label }) => (
    <li
      key={path}
      className={classnames({
        active: currentPath === path || currentPath.startsWith(`${path}/`),
      })}
    >
      <a href={`/admin/${path}`}>{label}</a>
    </li>
  );

  return (
    <>
      <br />
      <br />
      <nav className="navbar navbar-white navbar-admin">
        <div className="container">
          <div className="navbar-header">
            <a
              className="navbar-brand"
              href="/admin"
              aria-label="Admin dash index"
            >
              <img
                src={adminIcon}
                height="24"
                alt=""
                aria-hidden="true"
                focusable="false"
              />
            </a>
          </div>
          <ul className="nav navbar-nav">
            {pages.map(page => renderTab(page))}
          </ul>
          <ul className="nav navbar-nav pull-right">
            {renderTab({ path: 'audit-log', label: 'Audit log' })}
          </ul>
        </div>
      </nav>
    </>
  );
}

AdminHeader.propTypes = {};
