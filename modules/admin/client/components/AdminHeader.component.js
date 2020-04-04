// External dependencies
import classnames from 'classnames';
import React from 'react';

// Internal dependencies
import adminIcon from '../images/bmo.png';

export default function AdminHeader() {
  const path = window.location.pathname;
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
            <li className={classnames({ active: path === '/admin/user' })}>
              <a href="/admin/user">Member report card</a>
            </li>
            <li
              className={classnames({ active: path === '/admin/search-users' })}
            >
              <a href="/admin/search-users">Search members</a>
            </li>
            <li className={classnames({ active: path === '/admin/messages' })}>
              <a href="/admin/messages">Messages</a>
            </li>
            <li className={classnames({ active: path === '/admin/threads' })}>
              <a href="/admin/threads">Threads</a>
            </li>
            <li
              className={classnames({
                active: path === '/admin/acquisition-stories',
              })}
            >
              <a href="/admin/acquisition-stories">Acquisition stories</a>
            </li>
          </ul>
          <ul className="nav navbar-nav pull-right">
            <li className={classnames({ active: path === '/admin/audit-log' })}>
              <a href="/admin/audit-log">Audit log</a>
            </li>
          </ul>
        </div>
      </nav>
    </>
  );
}

AdminHeader.propTypes = {};
