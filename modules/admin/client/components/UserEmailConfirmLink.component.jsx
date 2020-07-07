// External dependencies
import React from 'react';
import PropTypes from 'prop-types';

export default function UserEmailConfirmLink({ user }) {
  if (!user || !user.emailToken || !user.emailTemporary) {
    return null;
  }

  // During signup, these emails are identical
  const isSignup = user.email === user.emailTemporary;

  return (
    <>
      {isSignup ? (
        <label htmlFor="user-email-reset-link">
          Link to confirm email {user.emailTemporary} during signup
        </label>
      ) : (
        <label htmlFor="user-email-reset-link">
          Link to confirm email change {user.email} → {user.emailTemporary}
        </label>
      )}
      <input
        className="form-control"
        id="user-email-reset-link"
        readOnly="readonly"
        type="text"
        value={`https://www.trustroots.org/confirm-email/${user.emailToken}${
          isSignup ? '?signup=true' : ''
        }`}
      />
      <p className="help-block">
        <span className="text-danger">
          Make sure to send this link <em>only</em> to email{' '}
          <b>{user.emailTemporary}</b> and nowhere else!
        </span>
      </p>
    </>
  );
}

UserEmailConfirmLink.propTypes = {
  user: PropTypes.object.isRequired,
};
