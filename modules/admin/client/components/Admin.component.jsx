import React from 'react';
import AdminHeader from './AdminHeader.component.jsx';
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
        <p>
          See our <a href="https://team.trustroots.org/">Team Guide</a> &{' '}
          <a href="https://trustroots.zendesk.com/inbox/">Support queue</a>.
        </p>
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
