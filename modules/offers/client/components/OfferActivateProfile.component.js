import React from 'react';

export default function OfferActivateProfile() {
  return (
    <div
      aria-labelledby="activate-profile-message"
      className="row"
      role="alertdialog"
    >
      <div className="col-xs-12 text-center" role="document" tabIndex="0">
        <h2>Do not panic!</h2>
        <p className="lead" id="activate-profile-message">
          <em>
            Sorry, you need to first activate your profile by confirming your
            email.
          </em>
        </p>
        <p>
          If you did not receive the message, check your spam folder or resend
          it via <a href="/profile/edit/account">email settings</a>.
        </p>
        <p>
          <br />
          <small>
            <a
              aria-label="Support"
              className="btn btn-xs btn-link text-muted"
              href="/support"
            >
              Help!
            </a>
          </small>
        </p>
      </div>
    </div>
  );
}
