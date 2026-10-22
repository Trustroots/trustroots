// External dependencies
import classnames from 'classnames';
import React, { useEffect } from 'react';
import { getCurrentUser } from '../../../core/client/services/client-runtime';

export default function AdminHeader() {
  const roles = getCurrentUser()?.roles || [];
  const isAdmin = roles.includes('admin');
  const isSupport = roles.includes('support-team');
  const isWelcomeTeam = roles.includes('welcome-team');
  const currentPath = window.location.pathname.replace('/admin/', '');

  useEffect(() => {
    const input = document.querySelector<HTMLInputElement>(
      '.container input:not([type="hidden"]):not([disabled])',
    );

    if (input) {
      input.focus({ preventScroll: true });
    }
  }, []);

  const groups = [
    {
      id: 'support',
      label: 'Member support',
      pages: [
        { path: 'support', label: 'Support inbox' },
        { path: 'staff-blockers', label: 'Staff blockers' },
        { path: 'location-corrections', label: 'Location corrections' },
      ],
    },
    {
      id: 'circles',
      label: 'Circles',
      pages: [
        { path: 'circles', label: 'Circles' },
        { path: 'hackerspaces', label: 'Hackerspaces' },
      ],
    },
    {
      id: 'conversations',
      label: 'Conversations',
      pages: [
        { path: 'messages', label: 'Messages' },
        { path: 'threads', label: 'Threads' },
      ],
    },
    {
      id: 'experiences',
      label: 'Experiences',
      pages: [
        { path: 'reference-threads', label: 'Reference threads' },
        { path: 'experience-changes', label: 'Experience changes' },
      ],
    },
    {
      id: 'outreach',
      label: 'Outreach',
      pages: [
        { path: 'acquisition-stories', label: 'Acquisition stories' },
        { path: 'newsletter', label: 'Newsletter' },
      ],
    },
    {
      id: 'audit',
      label: 'Audit',
      pages: [
        { path: 'audit-log', label: 'Audit log' },
        { path: 'username-changes', label: 'Username changes' },
      ],
    },
  ]
    .map(group => ({
      ...group,
      pages: group.pages.filter(
        page =>
          isAdmin ||
          (['support', 'experience-changes'].includes(page.path) &&
            isSupport) ||
          (page.path === 'staff-blockers' && (isWelcomeTeam || isSupport)) ||
          page.path === 'acquisition-stories' ||
          ((isWelcomeTeam || isSupport) &&
            page.path === 'location-corrections'),
      ),
    }))
    .filter(group => group.pages.length > 0);

  const renderTab = ({ path, label }: { path: string; label: string }) => (
    <li
      key={path}
      className={classnames({
        active: currentPath === path || currentPath.startsWith(`${path}/`),
      })}
    >
      <a
        href={`/admin/${path}`}
        aria-current={
          currentPath === path || currentPath.startsWith(`${path}/`)
            ? 'page'
            : undefined
        }
      >
        {label}
      </a>
    </li>
  );

  return (
    <nav
      className="navbar navbar-white navbar-admin"
      aria-label="Administration"
    >
      <div className="container">
        <div className="admin-nav-groups">
          {groups.map(group => (
            <div className="admin-nav-group" key={group.id}>
              <div
                className="admin-nav-group__label"
                id={`admin-nav-${group.id}`}
              >
                {group.label}
              </div>
              <ul
                className="nav navbar-nav"
                aria-labelledby={`admin-nav-${group.id}`}
              >
                {group.pages.map(renderTab)}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </nav>
  );
}

AdminHeader.propTypes = {};
