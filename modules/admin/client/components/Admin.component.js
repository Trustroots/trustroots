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
          <li>TODO: Search users (regexp)</li>
          <li>TODO: Most recent downvotes messages</li>
        </ul>

      </div>
    </>
  );
}

Admin.propTypes = {};
