import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import shuffle from 'lodash/shuffle';

import {
  trackEvent,
  getCurrentRouteParams,
  navigate,
} from '@/modules/core/client/services/client-runtime';
import { useAuth } from '@/modules/core/client/react-app/auth';
import JoinButton from '@/modules/tribes/client/components/JoinButton';
import * as tribesApi from '@/modules/tribes/client/api/tribes.api';
import * as authApi from '@/modules/users/client/api/auth.api';
import {
  applyAuthenticatedUser,
  getUsernameValidationError,
} from '@/modules/users/client/utils/auth';
import { getCircleBackgroundStyle } from '@/modules/tribes/client/utils';

const USERNAME_PATTERN = /^(?=.*[0-9A-Za-z])[0-9A-Za-z.\-_]{3,34}$/;
const USERNAME_MINLENGTH = 3;
const USERNAME_MAXLENGTH = 34;

function formatMemberCount(count) {
  if (count === 0) {
    return 'No members yet';
  }

  if (count === 1) {
    return 'One member';
  }

  return `${Number(count).toLocaleString()} members`;
}

function SignupTribePanel({ tribe, user, onMembershipUpdated }) {
  return (
    <div
      className="panel tribe tribe-image"
      style={getCircleBackgroundStyle(tribe, '906x240')}
    >
      <div
        className={classNames('tribe-content', {
          'is-image': tribe.image,
        })}
      >
        <div>
          <h3 className="tribe-label">{tribe.label}</h3>
          <div className="tribe-meta">{formatMemberCount(tribe.count)}</div>
        </div>
        <JoinButton
          className="btn btn-primary tribe-join"
          tribe={tribe}
          user={user}
          onUpdated={onMembershipUpdated}
        />
      </div>
    </div>
  );
}

SignupTribePanel.propTypes = {
  tribe: PropTypes.object.isRequired,
  user: PropTypes.object,
  onMembershipUpdated: PropTypes.func.isRequired,
};

function getCurrentUsernameFieldErrors(username) {
  const errors = {};

  if (!username) {
    errors.required = true;
    return errors;
  }

  if (username.length < USERNAME_MINLENGTH) {
    errors.minlength = true;
  }

  if (username.length > USERNAME_MAXLENGTH) {
    errors.maxlength = true;
  }

  if (!USERNAME_PATTERN.test(username)) {
    errors.pattern = true;
  }

  return errors;
}

export default function SignupPage() {
  const { user, setUser } = useAuth();
  const { tribe: tribeSlug } = getCurrentRouteParams();
  const [credentials, setCredentials] = useState({
    acquisitionStory: '',
    email: '',
    firstName: '',
    lastName: '',
    newsletter: false,
    password: '',
    username: '',
  });
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailTaken, setIsEmailTaken] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [tribe, setTribe] = useState(null);
  const [suggestedTribes, setSuggestedTribes] = useState([]);
  const [suggestedTribesLimit, setSuggestedTribesLimit] = useState(4);
  const [usernameDirty, setUsernameDirty] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(true);
  const [usernamePending, setUsernamePending] = useState(false);

  useEffect(() => {
    if (user && step === 1) {
      navigate('search.map');
    }
  }, [step, user]);

  useEffect(() => {
    let isMounted = true;

    async function loadSuggestedTribes(withoutTribeId) {
      const tribes = await tribesApi.read({ limit: 40 });
      const shuffled = shuffle(tribes).filter(
        suggestedTribe => suggestedTribe._id !== withoutTribeId,
      );

      if (isMounted) {
        setSuggestedTribes(shuffled);
      }
    }

    async function activate() {
      if (tribeSlug) {
        const referredTribe = await tribesApi.get(tribeSlug);

        if (isMounted && referredTribe?._id) {
          setTribe(referredTribe);
        }

        await loadSuggestedTribes(referredTribe?._id || null);
        return;
      }

      await loadSuggestedTribes();
    }

    activate();

    return () => {
      isMounted = false;
    };
  }, [tribeSlug]);

  useEffect(() => {
    if (!usernameDirty || !credentials.username) {
      return undefined;
    }

    const fieldErrors = getCurrentUsernameFieldErrors(credentials.username);

    if (Object.keys(fieldErrors).length > 0) {
      setUsernameAvailable(false);
      return undefined;
    }

    let isMounted = true;
    const timeoutId = window.setTimeout(async () => {
      setUsernamePending(true);

      try {
        const result = await authApi.validateSignup({
          username: credentials.username,
        });

        if (isMounted) {
          setUsernameAvailable(result?.valid !== false);
        }
      } catch {
        if (isMounted) {
          setUsernameAvailable(true);
        }
      } finally {
        if (isMounted) {
          setUsernamePending(false);
        }
      }
    }, 1000);

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [credentials.username, usernameDirty]);

  const usernameErrors = useMemo(() => {
    const errors = getCurrentUsernameFieldErrors(credentials.username);

    if (usernameDirty && !usernamePending && !usernameAvailable) {
      errors.username = true;
    }

    return errors;
  }, [credentials.username, usernameAvailable, usernameDirty, usernamePending]);

  const usernameErrorMessage = getUsernameValidationError({
    errors: usernameErrors,
    isDirty: usernameDirty,
    isValid: Object.keys(usernameErrors).length === 0,
    usernameMaxlength: USERNAME_MAXLENGTH,
    usernameMinlength: USERNAME_MINLENGTH,
    value: credentials.username,
  });

  const isStepOneValid =
    credentials.firstName &&
    credentials.lastName &&
    credentials.email &&
    credentials.password.length >= 8 &&
    Object.keys(usernameErrors).length === 0 &&
    !usernamePending;

  function updateCredential(field, value) {
    setCredentials(current => ({
      ...current,
      [field]: value,
    }));
  }

  function handleMembershipUpdated(data) {
    if (data?.user) {
      applyAuthenticatedUser(data.user, setUser);
    }
  }

  function handleOpenRules(event) {
    event.preventDefault();
    trackEvent('signup.rules.open', {
      category: 'signup',
      label: 'Open rules from signup form',
    });
    window.location.assign('/rules');
  }

  async function handleSubmitSignup() {
    setIsLoading(true);
    setIsEmailTaken(false);
    setErrorMessage('');

    try {
      const newUser = await authApi.signup(credentials);
      let authenticatedUser = newUser;

      if (tribe?._id) {
        const membership = await tribesApi.join(tribe._id);
        authenticatedUser = membership.user || newUser;
      }

      setStep(2);
      applyAuthenticatedUser(authenticatedUser, setUser);
    } catch (error) {
      const message =
        error?.response?.data?.message ??
        'Something went wrong while signing you up. Try again!';

      if (message === 'Account with this email exists already.') {
        setIsEmailTaken(true);
      } else {
        setErrorMessage(message);
      }
    } finally {
      setIsLoading(false);
    }
  }

  const visibleSuggestedTribes = suggestedTribes.slice(0, suggestedTribesLimit);

  return (
    <section className="container container-spacer">
      {errorMessage && (
        <div className="alert alert-danger text-center" role="alert">
          {errorMessage}
        </div>
      )}
      <form className="signin form-horizontal" noValidate autoComplete="off">
        <div className="row">
          <div className="col-xs-12 text-center">
            <h3>Join Trustroots</h3>
            {tribe?._id && step < 3 && (
              <p className="font-brand-light signup-tribe">
                + Circle {tribe.label}
              </p>
            )}
            <div className="signup-steps">
              <div
                className={classNames({
                  'font-brand-light': step !== 1,
                  'font-brand-semibold signup-step-active': step === 1,
                })}
              >
                <div className="signup-step-indicator">1</div>
                Info
              </div>
              <div className="signup-step-line" />
              <div
                className={classNames({
                  'font-brand-light': step !== 2,
                  'font-brand-semibold signup-step-active': step === 2,
                })}
              >
                <div className="signup-step-indicator">2</div>
                Circles
              </div>
              <div className="signup-step-line" />
              <div
                className={classNames({
                  'font-brand-light': step !== 3,
                  'font-brand-semibold signup-step-active': step === 3,
                })}
              >
                <div className="signup-step-indicator">3</div>
                Done
              </div>
            </div>
          </div>
        </div>

        <div className="row signup-form-steps">
          {step === 1 && (
            <div className="signup-form-step">
              <div className="col-xs-offset-1 col-xs-10 col-sm-offset-2 col-sm-8 col-md-offset-3 col-md-6 col-lg-offset-4 col-lg-4">
                <div className="form-group">
                  <label htmlFor="firstName" className="col-sm-4 control-label">
                    First Name
                  </label>
                  <div className="col-sm-8">
                    <input
                      type="text"
                      required
                      id="firstName"
                      name="firstName"
                      className="form-control input-lg"
                      value={credentials.firstName}
                      disabled={isLoading}
                      onChange={event =>
                        updateCredential('firstName', event.target.value)
                      }
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="lastName" className="col-sm-4 control-label">
                    Last Name
                  </label>
                  <div className="col-sm-8">
                    <input
                      type="text"
                      required
                      id="lastName"
                      name="lastName"
                      className="form-control input-lg"
                      value={credentials.lastName}
                      disabled={isLoading}
                      onChange={event =>
                        updateCredential('lastName', event.target.value)
                      }
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="email" className="col-sm-4 control-label">
                    Email
                  </label>
                  <div className="col-sm-8">
                    <input
                      type="email"
                      required
                      id="email"
                      name="email"
                      className="form-control input-lg"
                      value={credentials.email}
                      disabled={isLoading}
                      onChange={event => {
                        setIsEmailTaken(false);
                        updateCredential('email', event.target.value);
                      }}
                    />
                    {isEmailTaken && (
                      <div className="alert alert-danger" role="alert">
                        Account with this email exists already.{' '}
                        <a
                          href={`/password/forgot?userhandle=${encodeURIComponent(
                            credentials.email,
                          )}`}
                        >
                          Try recover password?
                        </a>
                      </div>
                    )}
                  </div>
                </div>
                <div
                  className={classNames('form-group', {
                    'has-error': usernameErrorMessage,
                  })}
                >
                  <label htmlFor="username" className="col-sm-4 control-label">
                    Username
                  </label>
                  <div className="col-sm-8">
                    <input
                      type="text"
                      required
                      id="username"
                      name="username"
                      autoCapitalize="off"
                      className="form-control input-lg"
                      value={credentials.username}
                      disabled={isLoading}
                      onBlur={() => setUsernameDirty(true)}
                      onChange={event =>
                        updateCredential('username', event.target.value)
                      }
                    />
                    {usernameErrorMessage && (
                      <p className="help-block">{usernameErrorMessage}</p>
                    )}
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="password" className="col-sm-4 control-label">
                    Password
                  </label>
                  <div className="col-sm-8">
                    <div className="input-group">
                      <input
                        required
                        id="password"
                        name="password"
                        className="form-control input-lg"
                        type={showPassword ? 'text' : 'password'}
                        autoCapitalize="off"
                        minLength={8}
                        value={credentials.password}
                        disabled={isLoading}
                        onChange={event =>
                          updateCredential('password', event.target.value)
                        }
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
                    {credentials.password &&
                      credentials.password.length < 8 && (
                        <p className="help-block">
                          Minimum length 8 characters.
                        </p>
                      )}
                  </div>
                </div>
                <div className="form-group checkbox">
                  <div className="col-sm-offset-4 col-sm-8">
                    <label>
                      <input
                        type="checkbox"
                        name="newsletter"
                        checked={credentials.newsletter}
                        disabled={isLoading}
                        onChange={event =>
                          updateCredential('newsletter', event.target.checked)
                        }
                      />
                      Subscribe to community news
                    </label>
                    <br />
                    <br />
                  </div>
                </div>
                <div className="form-group">
                  <div className="col-xs-8 col-sm-8 col-sm-offset-4 text-muted">
                    <p>
                      By signing up you agree to abide to our{' '}
                      <span className="visible-xs-inline">rules</span>
                      <a
                        className="hidden-xs"
                        href="/rules"
                        onClick={handleOpenRules}
                      >
                        rules
                      </a>{' '}
                      that include standards of behaviour that apply to
                      everyone.
                    </p>
                  </div>
                  <div className="col-xs-4 visible-xs-block">
                    <a
                      className="btn btn-default"
                      href="/rules"
                      onClick={handleOpenRules}
                    >
                      Read rules
                    </a>
                  </div>
                </div>
                <div className="form-group">
                  <label
                    className="col-sm-4 control-label"
                    htmlFor="acquisitionStory"
                  >
                    How did you hear about us?
                  </label>
                  <div className="col-sm-8">
                    <input
                      type="text"
                      id="acquisitionStory"
                      name="acquisitionStory"
                      className="form-control input-lg"
                      maxLength={500}
                      value={credentials.acquisitionStory}
                      onChange={event =>
                        updateCredential('acquisitionStory', event.target.value)
                      }
                    />
                  </div>
                </div>
                <div className="text-center form-group">
                  <br />
                  <button
                    type="button"
                    className="btn btn-lg btn-primary"
                    disabled={!isStepOneValid || isLoading}
                    onClick={handleSubmitSignup}
                  >
                    {isStepOneValid ? 'Next' : 'Please fill in the form'}
                  </button>
                  <br />
                  <br />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="signup-form-step">
              <div className="col-xs-offset-1 col-xs-10 col-sm-offset-2 col-sm-8 col-md-offset-3 col-md-6 col-lg-offset-4 col-lg-4 signup-tribe-suggestions">
                {tribe?._id && (
                  <SignupTribePanel
                    tribe={tribe}
                    user={user}
                    onMembershipUpdated={handleMembershipUpdated}
                  />
                )}
                {visibleSuggestedTribes.length > 0 && tribe?._id && (
                  <p className="lead text-center">
                    Other suggested circles for you
                  </p>
                )}
                {visibleSuggestedTribes.length > 0 && !tribe && (
                  <p className="lead text-center">
                    Do you want to join any Circles?
                  </p>
                )}
                <p className="text-center">
                  Circles help you find likeminded members and tell others what
                  you&apos;re interested in. There&apos;s no need to join any,
                  and if unsure you can always join them later.
                </p>
                {visibleSuggestedTribes.length > 0 && (
                  <ul className="list-unstyled tribe-suggestions-list">
                    {visibleSuggestedTribes.map(suggestedTribe => (
                      <li key={suggestedTribe._id}>
                        <SignupTribePanel
                          tribe={suggestedTribe}
                          user={user}
                          onMembershipUpdated={handleMembershipUpdated}
                        />
                      </li>
                    ))}
                  </ul>
                )}
                <div className="text-center">
                  <button
                    type="button"
                    className="btn btn-default center-block"
                    disabled={
                      suggestedTribesLimit >= suggestedTribes.length ||
                      suggestedTribes.length === 0
                    }
                    onClick={() =>
                      setSuggestedTribesLimit(current => current + 3)
                    }
                  >
                    Show more circles
                  </button>
                  <br />
                </div>
                <div className="text-center form-group">
                  <br />
                  <br />
                  <button
                    type="button"
                    className="btn btn-lg btn-primary"
                    disabled={isLoading}
                    onClick={() => setStep(3)}
                  >
                    Next
                  </button>
                  <button
                    type="button"
                    className="btn btn-lg btn-default"
                    disabled={isLoading}
                    onClick={() => setStep(3)}
                  >
                    Skip
                  </button>
                  <br />
                  <br />
                </div>
              </div>
            </div>
          )}

          {step === 3 && user && (
            <div className="signup-form-step">
              <div className="col-xs-offset-2 col-xs-8 col-md-offset-4 col-md-4 text-center">
                <h3>Welcome to Trustroots!</h3>
                <br />
                <p className="lead">
                  We sent you an email to <strong>{user.email}</strong> with
                  further instructions.
                  <br />
                  <br />
                  If you don&apos;t see this email in your inbox within 15
                  minutes, look for it in your junk mail folder. If you find it
                  there, please mark it as &quot;Not Junk&quot;.
                </p>
                <p>
                  <a
                    href="/profile/edit"
                    className="btn btn-lg btn-primary"
                    id="signup-edit"
                  >
                    Fill your profile
                  </a>
                </p>
              </div>
            </div>
          )}
        </div>

        {step === 1 && (
          <div className="row">
            <div className="text-center col-xs-offset-2 col-xs-8 col-md-offset-4 col-md-4">
              <br />
              <br />
              Already have an account? <a href="/signin">Login</a>
              <br />
              <br />
              <p className="visible-xs-block">
                <a href="/" className="btn btn-link">
                  About Trustroots
                </a>
              </p>
            </div>
          </div>
        )}
      </form>
    </section>
  );
}

SignupPage.propTypes = {};
