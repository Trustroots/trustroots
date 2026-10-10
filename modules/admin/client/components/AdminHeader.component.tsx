// External dependencies
import classnames from 'classnames';
import React, { useEffect } from 'react';
import { getCurrentUser } from '../../../core/client/services/client-runtime';

export default function AdminHeader() {
  const isAdmin = (getCurrentUser()?.roles || []).includes('admin');
  const isWelcomeTeam = (getCurrentUser()?.roles || []).includes(
    'welcome-team',
  );
  const currentPath = window.location.pathname.replace('/admin/', '');

  useEffect(() => {
    const input = document.querySelector<HTMLInputElement>(
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
      path: 'staff-blockers',
      label: 'Staff blockers',
    },
    {
      path: 'newsletter',
      label: 'Newsletter',
    },
    {
      path: 'circles',
      label: 'Circles',
    },
  ];

  const renderTab = ({ path, label }: { path: string; label: string }) => (
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
            {isAdmin ? 'Admin' : 'Greeters'}
          </a>
        </div>
        <ul className="nav navbar-nav">
          {pages
            .filter(
              page =>
                isAdmin ||
                (page.path === 'staff-blockers' && isWelcomeTeam) ||
                page.path === 'acquisition-stories',
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
