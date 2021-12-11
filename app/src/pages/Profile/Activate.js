import React from 'react';

export default function Activate() {

  return (
    <div
      className="row"
      role="alertdialog"
      aria-labelledby="activate-profile-message"
    >
      <div className="col-xs-12 text-center" role="document" tabIndex="0">
        <h2>Don't panic!</h2>
        <p className="lead" id="activate-profile-message">
          <em>
            Sorry, you need to first activate your profile by confirming your email.
          </em>
        </p>
        <p>
            If you didn&apos;t receive the message, check your spam folder or
            resend it via 
            <a href="/profile/edit/account">email settings</a>.
        </p>
        <p>
          <br />
          <small>
            <a
              className="btn btn-xs btn-link text-muted"
              href="/support"
              aria-label="Support"
            >
              Help!
            </a>
          </small>
        </p>
      </div>
    </div>
  );
}
