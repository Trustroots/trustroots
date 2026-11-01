import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@trustroots/ui/Button';

import Board from '@/modules/core/client/components/Board';
import useDesktopAutofocus from '@/modules/core/client/hooks/use-desktop-autofocus';
import {
  trackEvent,
  getCurrentRouteParams,
} from '@/modules/core/client/services/client-runtime';
import { useAuth } from '@/modules/core/client/react-app/auth';
import * as authApi from '@/modules/users/client/api/auth.api';
import { redirectAfterSignin } from '@/modules/users/client/utils/auth';
import { readApiError } from '../utils/api-error';

const BoardWithPhotoList = Board as unknown as React.ComponentType<{
  names: string | string[];
  className?: string;
  children?: React.ReactNode;
}>;

export default function SigninPage() {
  const { user, setUser } = useAuth() as {
    user: { _id: string; username: string } | null;
    setUser: (user: { _id: string; username: string; email?: string }) => void;
  };
  const {
    continue: continueSignin,
    returnTo,
    userhandle,
  } = getCurrentRouteParams();
  const [credentials, setCredentials] = useState({
    password: '',
    username: userhandle || '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const hasRedirected = useRef(false);
  const usernameInput = useDesktopAutofocus<HTMLInputElement>();
  const signinDestination = useRef({
    continueSignin: Boolean(continueSignin),
    returnTo,
  });

  useEffect(() => {
    if (user && !hasRedirected.current) {
      hasRedirected.current = true;
      redirectAfterSignin(
        signinDestination.current.continueSignin,
        signinDestination.current.returnTo,
      );
    }
  }, [user]);

  function updateCredential(field: 'username' | 'password', value: string) {
    setCredentials(current => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setAuthError(false);
    setErrorMessage('');

    try {
      const signedInUser = await authApi.signin(credentials);

      let session;
      try {
        session = await authApi.getSession();
      } catch {
        setIsLoading(false);
        setErrorMessage(
          "Your login details were accepted, but we couldn't check your session. Check your connection and try again.",
        );
        return;
      }

      if (session.userId !== signedInUser._id) {
        setIsLoading(false);
        setErrorMessage(
          "Your login details were accepted, but we couldn't keep you signed in. Cookies may be blocked, or there may be a problem with the site. Please try again or contact support.",
        );
        return;
      }

      setUser(signedInUser);

      trackEvent('login.success', {
        category: 'authentication',
        label: 'Login success',
      });
    } catch (error: unknown) {
      setIsLoading(false);
      setAuthError(true);
      setErrorMessage(readApiError(error).message || 'Something went wrong.');
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
    <BoardWithPhotoList
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
                      ref={usernameInput}
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
                      />
                      <span className="input-group-btn">
                        <Button
                          size="lg"
                          className="password-toggle"
                          type="button"
                          aria-label="Toggle password visibility"
                          onClick={() => setShowPassword(current => !current)}
                        >
                          <i
                            className={`icon-lg ${
                              showPassword ? 'icon-eye-off' : 'icon-eye'
                            }`}
                          />
                        </Button>
                      </span>
                    </div>
                  </div>
                  <div className="form-group">
                    <Button size="lg" type="submit" disabled={isLoading}>
                      {isLoading
                        ? 'Wait...'
                        : continueSignin
                          ? 'Sign in to continue'
                          : 'Login'}
                    </Button>
                    <Button
                      variant="plain"
                      render={<span />}
                      className="space-h"
                    />
                    <a href={forgotHref}>
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
                <Button
                  variant="inverse"
                  size="lg"
                  className="signup-button"
                  render={<a href="/signup" />}
                >
                  Become a member
                </Button>
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
    </BoardWithPhotoList>
  );
}
