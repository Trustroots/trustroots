import React from 'react';

export default function Admin() {
  return (
    <>
      <style>
        {`#wrapper {
          margin-top: 60px;
        }`}
      </style>
      <div className="container" id="wrapper">

        <h2>Trustroots admin dashboard</h2>

        <p>In development.</p>

        <ul>
          <li>TODO: <a ui-sref="admin-search-users">Search users (regexp)</a></li>
          <li>TODO: Most recent downvoted threads</li>
          <li>TODO: new signups: how did you hear about trustroots?</li>
        </ul>

      </div>
    </>
  );
}

Admin.propTypes = {};
