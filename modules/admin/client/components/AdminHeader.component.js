// External dependencies
import classnames from 'classnames';
import React, { useEffect } from 'react';
import { getUser } from '../../../core/client/services/angular-compat';

export default function AdminHeader() {
  const isAdmin = (getUser()?.roles || []).includes('admin');
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
          <a
            className="navbar-brand"
            href={isAdmin ? '/admin' : '/admin/acquisition-stories'}
          >
            {isAdmin ? 'Admin' : 'Welcome team'}
          </a>
        </div>
        <ul className="nav navbar-nav">
          {pages
            .filter(page => isAdmin || page.path === 'acquisition-stories')
            .map(page => renderTab(page))}
        </ul>
        <ul className="nav navbar-nav pull-right">
          {isAdmin && renderTab({ path: 'audit-log', label: 'Audit log' })}
        </ul>
      </div>
    </nav>
  );
}

AdminHeader.propTypes = {};
