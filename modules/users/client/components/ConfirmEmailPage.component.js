import React, { useState } from 'react';

import {
  getCurrentRouteParams,
  navigate,
} from '@/modules/core/client/services/client-runtime';
import { useAuth } from '@/modules/core/client/react-app/auth';
import * as authApi from '@/modules/users/client/api/auth.api';
import {
  applyAuthenticatedUser,
  getEmailFromToken,
} from '@/modules/users/client/utils/auth';

export default function ConfirmEmailPage() {
  const { user, setUser } = useAuth();
  const { signup, token } = getCurrentRouteParams();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const email = getEmailFromToken(token || '');

  async function handleConfirmEmail(event) {
    event.preventDefault();
    setIsLoading(true);
    setSuccess(false);
    setError(false);

    try {
      const response = await authApi.confirmEmail(token);

      applyAuthenticatedUser(response.user, setUser);

      if (response.profileMadePublic) {
        navigate('welcome');
        return;
      }

      setSuccess(true);
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="container container-spacer">
      <form
        className="form-horizontal"
        noValidate
        autoComplete="off"
        onSubmit={handleConfirmEmail}
      >
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
              {!success && (
                <div className="text-center form-group">
                  {
                    /* istanbul ignore next -- token decoding is covered by auth integration tests. */
                    email && <h4>{email}</h4>
                  }
                  <p className="lead">
                    {signup
                      ? 'Confirm your email and make your profile visible to others.'
                      : 'Confirm your email.'}
                  </p>
                  <button
                    type="submit"
                    className="btn btn-lg btn-primary"
                    disabled={isLoading || error}
                  >
                    Confirm
                  </button>
                </div>
              )}
              {error && (
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
                      To send a new confirmation or change your email, navigate
                      to <a href="/profile/edit/account">your settings</a>.
                    </p>
                  ) : (
                    <p>
                      <a href="/signin">Login first</a> to send a new
                      confirmation or change your email.
                    </p>
                  )}
                </div>
              )}
              {success && (
                <div className="alert alert-success text-center" role="alert">
                  <p>
                    <strong>Your email is now confirmed!</strong>
                  </p>
                  <p>
                    <a href="/profile/edit">Edit your profile</a>
                  </p>
                </div>
              )}
            </div>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
