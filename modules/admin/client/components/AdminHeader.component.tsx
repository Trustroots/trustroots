// External dependencies
import classnames from 'classnames';
import React, { useEffect } from 'react';
import { useAuth } from '../../../core/client/react-app/auth';

export default function AdminHeader() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');
  const isSupport = hasRole('support-team');
  const isWelcomeTeam = hasRole('welcome-team');
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
        { path: 'support/members', label: 'Member search' },
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
        { path: 'spam-cleanup', label: 'Spam account cleanup' },
      ],
    },
  ]
    .map(group => ({
      ...group,
      pages: group.pages.filter(
        page =>
          isAdmin ||
          (['support', 'support/members', 'experience-changes'].includes(
            page.path,
          ) &&
            isSupport) ||
          (page.path === 'staff-blockers' && (isWelcomeTeam || isSupport)) ||
          page.path === 'acquisition-stories' ||
          ((isWelcomeTeam || isSupport) &&
            page.path === 'location-corrections'),
      ),
    }))
    .filter(group => group.pages.length > 0);

  const isActivePage = (path: string) => {
    if (path === 'support') {
      return (
        currentPath === path ||
        currentPath.startsWith('support/requests/') ||
        currentPath.startsWith('support/member/')
      );
    }
    if (path === 'support/members') return currentPath === path;
    return currentPath === path || currentPath.startsWith(`${path}/`);
  };

  const renderTab = ({ path, label }: { path: string; label: string }) => {
    const active = isActivePage(path);
    return (
      <li key={path} className={classnames({ active })}>
        <a href={`/admin/${path}`} aria-current={active ? 'page' : undefined}>
          {label}
        </a>
      </li>
    );
  };

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
