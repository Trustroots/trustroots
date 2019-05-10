import React from 'react';
import AdminHeader from './AdminHeader.component.js';

export default function Admin() {
  return (
    <div className="container container-spacer">
      <AdminHeader />
      <p>Welcome, friend! 👋</p>
      <p><a href="https://team.trustroots.org/">Team guide</a></p>
    </div>
  );
}

Admin.propTypes = {};
