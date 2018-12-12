import React from 'react';

export default function AdminSearchUsers() {
  return (
    <>
      <style>
        {`#wrapper {
          margin-top: 60px;
        }`}
      </style>
      <div className="container" id="wrapper">

        <h2>Trustroots admin search users</h2>

        <p>Search users with regexp</p>

        <input type="text" />

      </div>
    </>
  );
}

AdminSearchUsers.propTypes = {};
