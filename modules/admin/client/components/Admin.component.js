import React from 'react';

export default function Admin() {
  return (
    <>
      <div className="container container-spacer">

        <h2>Trustroots admin dashboard</h2>

        <p>In development.</p>

        <ul>
          <li><a href="/admin/search-users">Search users (no regexp yet)</a></li>
          <li>TODO: Most recent downvoted threads</li>
          <li>TODO: new signups: how did you hear about trustroots?</li>
        </ul>

      </div>
    </>
  );
}

Admin.propTypes = {};
