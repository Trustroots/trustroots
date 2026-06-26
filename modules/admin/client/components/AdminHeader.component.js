// External dependencies
import classnames from 'classnames';
import React, { useEffect } from 'react';

export default function AdminHeader() {
  const currentPath = window.location.pathname.replace('/admin/', '');

  useEffect(() => {
    const input = document.querySelector(
      '.container input:not([type="hidden"]):not([disabled])',
    );

    if (input) {
      input.focus({ preventScroll: true });
    }
  }, []);

  const pages = [
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
    <nav className="navbar navbar-white navbar-admin">
      <div className="container">
        <div className="navbar-header">
          <a className="navbar-brand" href="/admin">
            Admin
          </a>
        </div>
        <ul className="nav navbar-nav">{pages.map(page => renderTab(page))}</ul>
        <ul className="nav navbar-nav pull-right">
          {renderTab({ path: 'audit-log', label: 'Audit log' })}
        </ul>
      </div>
    </nav>
  );
}

AdminHeader.propTypes = {};
