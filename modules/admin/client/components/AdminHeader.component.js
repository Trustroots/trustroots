import React from 'react';

export default function AdminHeader() {
  return (
    <>
      <h1><a href="/admin">Trustroots admin dashboard</a></h1>
      <ul className="nav nav-pills">
        <li><a href="/admin/search-users">Search users</a></li>
      </ul>
      <hr/>
    </>
  );
}

AdminHeader.propTypes = {};
