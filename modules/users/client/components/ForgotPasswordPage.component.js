import React, { useState } from 'react';

import Board from '@/modules/core/client/components/Board';
import { getCurrentRouteParams } from '@/modules/core/client/services/client-runtime';
import * as authApi from '@/modules/users/client/api/auth.api';

export default function ForgotPasswordPage() {
  const { userhandle } = getCurrentRouteParams();
  const [credentials, setCredentials] = useState({
    username: userhandle || '',
  });
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSuccess(null);
    setError(null);
    setIsLoading(true);

    try {
      const response = await authApi.forgotPassword(credentials);
      setCredentials({ username: '' });
      setSuccess(response.message);
    } catch (requestError) {
      setError(requestError?.response?.data?.message);
    } finally {
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
        <h3 className="col-xs-12 text-center">Restore your password</h3>
        <div className="col-xs-offset-1 col-xs-10 col-sm-offset-4 col-sm-4 col-md-offset-5 col-md-2">
          <br />
          <form
            className="form-auth form-horizontal"
            autoComplete="off"
            onSubmit={handleSubmit}
          >
            <fieldset>
              <div className="form-group text-center">
                <label htmlFor="username">Email or username</label>
                <input
                  type="text"
                  required
                  id="username"
                  name="username"
                  className="form-control input-lg"
                  value={credentials.username}
                  disabled={isLoading}
                  onChange={event =>
                    setCredentials({ username: event.target.value })
                  }
                />
              </div>
              <div className="text-center form-group">
                <button
                  type="submit"
                  className="btn btn-lg btn-default"
                  disabled={isLoading || !credentials.username}
                >
                  {isLoading ? 'Wait...' : 'Restore'}
                </button>
              </div>
              {error && (
                <div className="text-center alert alert-danger" role="alert">
                  <strong>{error}</strong>
                </div>
              )}
              {success && (
                <div className="text-center alert alert-success" role="alert">
                  <p>
                    <strong>
                      We sent you an email with further instructions.
                    </strong>
                  </p>
                  <p>
                    If you don&apos;t see this email in your inbox within 15
                    minutes, look for it in your junk mail folder. If you find
                    it there, please mark it as &quot;Not Junk&quot;.
                  </p>
                </div>
              )}
            </fieldset>
          </form>
        </div>
      </div>
    </Board>
  );
}
