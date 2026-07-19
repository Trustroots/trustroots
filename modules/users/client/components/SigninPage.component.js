import React, { useEffect, useState } from 'react';

import Board from '@/modules/core/client/components/Board';
import {
  trackEvent,
  getCurrentRouteParams,
  navigate,
} from '@/modules/core/client/services/client-runtime';
import { useAuth } from '@/modules/core/client/react-app/auth';
import * as authApi from '@/modules/users/client/api/auth.api';
import {
  applyAuthenticatedUser,
  redirectAfterSignin,
} from '@/modules/users/client/utils/auth';

export default function SigninPage() {
  const { user, setUser } = useAuth();
  const { continue: continueSignin, userhandle } = getCurrentRouteParams();
  const [credentials, setCredentials] = useState({
    password: '',
    username: userhandle || '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (user) {
      navigate('search.map');
    }
  }, [user]);

  function updateCredential(field, value) {
    setCredentials(current => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsLoading(true);
    setAuthError(false);
    setErrorMessage('');

    try {
      const signedInUser = await authApi.signin(credentials);

      applyAuthenticatedUser(signedInUser, setUser);

      trackEvent('login.success', {
        category: 'authentication',
        label: 'Login success',
      });

      redirectAfterSignin(Boolean(continueSignin));
    } catch (error) {
      setIsLoading(false);
      setAuthError(true);
      setErrorMessage(
        error?.response?.data?.message || 'Something went wrong.',
      );
      trackEvent('login.failed', {
        category: 'authentication',
        label: 'Login failed',
      });
    }
  }

  const forgotHref = credentials.username
    ? `/password/forgot?userhandle=${encodeURIComponent(credentials.username)}`
    : '/password/forgot';

  return (
    <Board
      names={['nordiclights', 'jungleroad']}
      className="container container-fullscreen"
    >
      <div className="middle-wrapper middle-wrapper-horizontal">
        <div className="middle-content">
          <div className="row">
            <div className="col-xs-12 col-sm-offset-3 col-sm-6 col-md-offset-4 col-md-4">
              {errorMessage && (
                <div className="alert alert-danger" role="alert">
                  {errorMessage}
                </div>
              )}
              <form
                className="form-auth"
                autoComplete="off"
                onSubmit={handleSubmit}
              >
                <fieldset>
                  <div className="form-group">
                    <label htmlFor="username" className="lead">
                      Email or username
                    </label>
                    <input
                      type="text"
                      autoCapitalize="off"
                      required
                      id="username"
                      name="username"
                      className="form-control input-lg"
                      placeholder="Email or username"
                      value={credentials.username}
                      disabled={isLoading}
                      onChange={event =>
                        updateCredential('username', event.target.value)
                      }
                      tabIndex={1}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="password" className="lead">
                      Password
                    </label>
                    <div className="input-group">
                      <input
                        required
                        id="password"
                        name="password"
                        placeholder="Password"
                        className="form-control input-lg"
                        type={showPassword ? 'text' : 'password'}
                        autoCapitalize="off"
                        disabled={isLoading}
                        value={credentials.password}
                        onChange={event =>
                          updateCredential('password', event.target.value)
                        }
                        tabIndex={2}
                      />
                      <span className="input-group-btn">
                        <button
                          type="button"
                          className="btn btn-lg btn-default btn-password-toggle"
                          aria-label="Toggle password visibility"
                          onClick={() => setShowPassword(current => !current)}
                        >
                          <i
                            className={`icon-lg ${
                              showPassword ? 'icon-eye-off' : 'icon-eye'
                            }`}
                          />
                        </button>
                      </span>
                    </div>
                  </div>
                  <div className="form-group">
                    <button
                      type="submit"
                      className="btn btn-default btn-lg"
                      disabled={isLoading}
                      tabIndex={3}
                    >
                      {isLoading
                        ? 'Wait...'
                        : continueSignin
                        ? 'Sign in to continue'
                        : 'Login'}
                    </button>
                    <span className="btn space-h" />
                    <a
                      href={forgotHref}
                      className={`btn-link${
                        authError ? ' btn-lg btn-link' : ''
                      }`}
                      tabIndex={4}
                    >
                      Forgot?
                      {authError && (
                        <span className="hidden-xs">
                          {' '}
                          Recover your password
                        </span>
                      )}
                    </a>
                  </div>
                </fieldset>
              </form>
              <div className="text-white hidden-xs">
                <br />
                <a href="/signup" className="btn btn-inverse btn-lg btn-signup">
                  Become a member
                </a>
                <span>&nbsp;&nbsp;or&nbsp;&nbsp;</span>
                <a href="/" className="link">
                  Back home
                </a>
              </div>
            </div>
          </div>

          <nav className="navbar navbar-default navbar-fixed-bottom visible-xs-block">
            <div className="container">
              <ul
                className="nav navbar-nav nav-justified"
                role="toolbar"
                aria-label="Profile actions"
              >
                <li>
                  <a href="/" aria-label="Go to home page">
                    Back home
                  </a>
                </li>
                <li className="pull-right">
                  <a href="/signup" aria-label="Sign up">
                    Become a member
                  </a>
                </li>
              </ul>
            </div>
          </nav>
        </div>
      </div>
    </Board>
  );
}
