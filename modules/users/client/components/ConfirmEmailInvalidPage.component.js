import React from 'react';

import { useAuth } from '@/modules/core/client/react-app/auth';

export default function ConfirmEmailInvalidPage() {
  const { user } = useAuth();

  return (
    <section className="container container-spacer">
      <form className="form-horizontal" noValidate autoComplete="off">
        <fieldset>
          <div className="row">
            <div className="col-xs-12 text-center">
              <img
                className="hidden-xs"
                src="/img/tree-color.svg"
                alt="Trustroots"
                width="120"
                height="120"
                aria-hidden="true"
              />
              <img
                className="visible-xs-inline-block"
                src="/img/tree-color.svg"
                alt="Trustroots"
                width="80"
                height="80"
                aria-hidden="true"
              />
              <br />
              <br />
            </div>
          </div>

          <div className="row">
            <div className="col-xs-offset-2 col-xs-8 col-md-offset-4 col-md-4">
              <div className="alert alert-danger text-center" role="alert">
                <p>
                  <strong>
                    Email confirm token is invalid or has expired.
                  </strong>
                </p>
                <p>
                  Perhaps you already confirmed your email?
                  {user && (
                    <>
                      {' '}
                      Your current activated email is{' '}
                      <strong>{user.email}</strong>
                    </>
                  )}
                </p>
                {user ? (
                  <p>
                    To send a new confirmation or change your email, go to{' '}
                    <a href="/profile/edit/account">your settings</a>.
                  </p>
                ) : (
                  <p>
                    <a href="/signin">Login first</a> to send a new confirmation
                    or change your email.
                  </p>
                )}
              </div>
            </div>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
