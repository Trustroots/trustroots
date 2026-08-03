import React, { useState } from 'react';

import Board from '@/modules/core/client/components/Board';
import {
  getCurrentRouteParams,
  navigate,
} from '@/modules/core/client/services/client-runtime';
import { useAuth } from '@/modules/core/client/react-app/auth';
import * as authApi from '@/modules/users/client/api/auth.api';
import { applyAuthenticatedUser } from '@/modules/users/client/utils/auth';

export default function ResetPasswordPage() {
  const { token } = getCurrentRouteParams();
  const { setUser } = useAuth();
  const [passwordDetails, setPasswordDetails] = useState({
    newPassword: '',
    verifyPassword: '',
  });
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    if (passwordDetails.newPassword !== passwordDetails.verifyPassword) {
      setError('Passwords do not match.');
      setIsLoading(false);
      return;
    }

    try {
      const user = await authApi.resetPassword(token, passwordDetails);

      applyAuthenticatedUser(user, setUser);
      navigate('reset-success');
    } catch (requestError) {
      setError(requestError?.response?.data?.message);
      setIsLoading(false);
    }
  }

  return (
    <Board
      names="bokeh"
      className="container container-spacer container-fullscreen"
    >
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
        </div>
      </div>
      <div className="row">
        <h3 className="col-xs-12 text-center">Reset your password</h3>
        <div className="col-xs-offset-1 col-xs-10 col-sm-offset-4 col-sm-4 col-md-offset-5 col-md-2">
          <br />
          <form
            className="form-horizontal form-auth"
            autoComplete="off"
            onSubmit={handleSubmit}
          >
            <fieldset>
              <div className="form-group">
                <label htmlFor="newPassword">New Password</label>
                <input
                  type="password"
                  required
                  id="newPassword"
                  name="newPassword"
                  className="form-control input-lg"
                  placeholder="New Password"
                  minLength={8}
                  value={passwordDetails.newPassword}
                  onChange={event => {
                    const { value } = event.target;

                    setPasswordDetails(current => ({
                      ...current,
                      newPassword: value,
                    }));
                  }}
                />
              </div>
              <div className="form-group">
                <label htmlFor="verifyPassword">Verify Password</label>
                <input
                  type="password"
                  required
                  id="verifyPassword"
                  name="verifyPassword"
                  className="form-control input-lg"
                  placeholder="Verify Password"
                  minLength={8}
                  value={passwordDetails.verifyPassword}
                  onChange={event => {
                    const { value } = event.target;

                    setPasswordDetails(current => ({
                      ...current,
                      verifyPassword: value,
                    }));
                  }}
                />
              </div>
              <div className="text-center form-group">
                <button
                  type="submit"
                  className="btn btn-lg btn-default"
                  disabled={
                    isLoading ||
                    passwordDetails.newPassword.length < 8 ||
                    passwordDetails.verifyPassword.length < 8
                  }
                >
                  Update Password
                </button>
              </div>
              {error && (
                <div className="text-center alert alert-danger" role="alert">
                  <strong>{error}</strong>
                </div>
              )}
            </fieldset>
          </form>
        </div>
      </div>
    </Board>
  );
}
