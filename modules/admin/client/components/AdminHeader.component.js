// External dependencies
import classnames from 'classnames';
import React, { useEffect } from 'react';
import { getCurrentUser } from '../../../core/client/services/client-runtime';

export default function AdminHeader() {
  const roles = getCurrentUser()?.roles || [];
  const isAdmin = roles.includes('admin');
  const isWelcomeTeam = roles.includes('welcome-team');
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
      path: 'acquisition-stories/analysis',
      label: 'Analysis',
    },
    {
      path: 'location-corrections',
      label: 'Location corrections',
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
        active: currentPath === path,
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
            .filter(
              page =>
                isAdmin ||
                page.path === 'acquisition-stories' ||
                page.path === 'acquisition-stories/analysis' ||
                (isWelcomeTeam && page.path === 'location-corrections'),
            )
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
