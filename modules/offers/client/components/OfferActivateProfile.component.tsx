import React from 'react';
import { Button } from '@trustroots/ui/Button';

export default function OfferActivateProfile() {
  return (
    <div
      aria-labelledby="activate-profile-message"
      className="row"
      role="alertdialog"
    >
      <div className="col-xs-12 text-center" role="document">
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
            <Button
              aria-label="Support"
              variant="link"
              colour="muted"
              size="xs"
              render={<a href="/support" />}
            >
              Help!
            </Button>
          </small>
        </p>
      </div>
    </div>
  );
}
