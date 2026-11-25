import React from 'react';

import { useAuth } from '@trustroots/core/auth';
import { Alert } from '@trustroots/ui/Alert';

export default function ConfirmEmailInvalidPage() {
  const { user } = useAuth() as { user: { email?: string } | null };

  return (
    <section className="tw:page-container container-spacer">
      <form className="form-horizontal" noValidate autoComplete="off">
        <fieldset>
          <div className="tw:grid-row">
            <div className="tw:grid-col-12 text-center">
              <img
                className="tw:max-sm:hidden"
                src="/img/tree-color.svg"
                alt="Trustroots"
                width="120"
                height="120"
                aria-hidden="true"
              />
              <img
                className="tw:inline-block tw:sm:hidden"
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

          <div className="tw:grid-row">
            <div className="tw:grid-offset-2 tw:grid-col-8 tw:md:grid-offset-4 tw:md:grid-col-4">
              <Alert className="tw:text-center" intent="danger" role="alert">
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
              </Alert>
            </div>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
