// External dependencies
import classnames from 'classnames';
import React from 'react';

// Internal dependencies
import adminIcon from '../../../core/client/icons/baseline-feedback.svg';

export default function AdminHeader() {
  const path = window.location.pathname;
  return (
    <>
      <br/><br/>
      <nav className="navbar navbar-white navbar-admin">
        <div className="container">
          <div className="navbar-header">
            <a className="navbar-brand" href="/admin" aria-label="Admin dash index">
              <img src={ adminIcon } alt="" aria-hidden="true" focusable="false" />
            </a>
          </div>
          <ul className="nav navbar-nav">
            <li className={ classnames({ 'active': path === '/admin/user' })}>
              <a href="/admin/user">Show user</a>
            </li>
            <li className={ classnames({ 'active': path === '/admin/search-users' })}>
              <a href="/admin/search-users">Search users</a>
            </li>
          </ul>
          <p className="navbar-text pull-right text-muted hidden-xs"><em>Admin dash</em></p>
        </div>
      </nav>
    </>
  );
}

AdminHeader.propTypes = {};
