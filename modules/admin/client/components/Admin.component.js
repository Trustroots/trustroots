import React from 'react';
import AdminHeader from './AdminHeader.component.js';
import bmoDancing from '../images/bmo-dancing.gif';

export default function Admin() {
  return (
    <>
      <AdminHeader />
      <div className="container container-spacer">
        <p>
          <img src={bmoDancing} alt="" width="200" />
        </p>
        <p>Welcome, friend! 👋</p>
        <ul>
          <li>
            <a href="https://team.trustroots.org/">Team Guide</a>
          </li>
          <li>
            <a href="https://trustroots.zendesk.com/inbox/">Support queue</a>
          </li>
          <li>
            <a href="https://ideas.trustroots.org/wp-admin/">Blog admin</a>
          </li>
          <li>
            <a href="https://ideas.trustroots.org/wp-admin/admin.php?page=mailpoet-newsletters">
              Newsletter admin
            </a>
          </li>
          <li>
            <a href="https://grafana.trustroots.org/">Statistics</a>
          </li>
        </ul>
        <p>
          <strong>
            <em>Remember to logout on public computers!</em>
          </strong>
        </p>
      </div>
    </>
  );
}

Admin.propTypes = {};
