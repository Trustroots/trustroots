import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import ActivateProfileNotice from '@/modules/users/client/components/ActivateProfileNotice.component';
import Avatar from '@/modules/users/client/components/Avatar.component';
import { fetchMini } from '@/modules/users/client/api/users.api';
import * as contactsApi from '@/modules/contacts/client/api/contacts.api';
import { getCurrentRouteParams } from '@/modules/core/client/services/client-runtime';
import TrEditor from '@/modules/core/client/components/TrEditor';
import LoadingIndicator from '@/modules/core/client/components/LoadingIndicator';

function defaultContactMessage(displayName) {
  return `<p>Hi!</p><p>I would like to add you as a contact.</p><p>- ${displayName}</p>`;
}

export default function ContactAddPage({ user }) {
  const { t } = useTranslation('contacts');
  const { userId } = getCurrentRouteParams();
  const [friend, setFriend] = useState(null);
  const [message, setMessage] = useState(
    defaultContactMessage(user.displayName),
  );
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadPage() {
      if (userId === user._id) {
        setIsConnected(true);
        setError(t('You cannot connect with yourself. That is just silly!'));
        setIsFetching(false);
        return;
      }

      try {
        const loadedFriend = await fetchMini(userId);

        if (!isMounted) {
          return;
        }

        setFriend(loadedFriend);

        const existingContact = await contactsApi.getByUserId(userId);

        if (!isMounted) {
          return;
        }

        if (existingContact) {
          setIsConnected(true);
          setSuccess(
            existingContact.confirmed
              ? t('You two are already connected. Great!')
              : t('Connection already initiated; now it has to be confirmed.'),
          );
        }
      } catch {
        /* istanbul ignore else -- state writes after unmount are intentionally suppressed. */
        if (isMounted) {
          setIsConnected(true);
          setError(t('User does not exist.'));
        }
      } finally {
        if (isMounted) {
          setIsFetching(false);
        }
      }
    }

    loadPage();

    return () => {
      isMounted = false;
    };
  }, [t, user._id, user.displayName, userId]);

  async function handleSubmit(event) {
    event.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await contactsApi.create({
        friendUserId: userId,
        message,
      });
      setSuccess(
        t(
          'Done! We sent an email to your contact and he/she still needs to confirm it.',
        ),
      );
      setIsConnected(true);
    } catch (requestError) {
      if (requestError.response?.status === 409) {
        setSuccess(
          requestError.response.data.confirmed
            ? t('You two are already connected. Great!')
            : t('Connection already initiated; now it has to be confirmed.'),
        );
        setIsConnected(true);
      } else {
        setError(
          requestError.response?.data?.message ||
            t('Something went wrong. Try again.'),
        );
      }
    } finally {
      setIsLoading(false);
    }
  }

  if (!user.public) {
    return (
      <section className="container container-spacer">
        <ActivateProfileNotice />
      </section>
    );
  }

  return (
    <section className="container container-spacer">
      <form onSubmit={handleSubmit} autoComplete="off">
        <div className="row">
          <div className="col-xs-12 col-sm-offset-1 col-sm-10 col-md-offset-2 col-md-8 col-lg-offset-3 col-lg-6">
            <div className="page-header">
              <h2>{t('Add contact')}</h2>
            </div>

            {isFetching && <LoadingIndicator />}

            {!isFetching && friend?._id && (
              <div className="panel panel-default contacts-connection">
                <div className="panel-body">
                  <div className="row">
                    <div className="col-xs-12 col-sm-5 contacts-connection-profile text-center">
                      <Avatar size={128} user={user} link={false} />
                      <h4 className="contacts-connection-name">
                        {user.displayName}
                      </h4>
                    </div>
                    <div className="hidden-xs col-sm-2">
                      <i className="icon-exchange icon-3x text-muted contacts-connection-divider" />
                    </div>
                    <div className="col-xs-12 col-sm-5 contacts-connection-profile text-center">
                      <Avatar size={128} user={friend} link={false} />
                      <h4 className="contacts-connection-name">
                        {friend.displayName}
                      </h4>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!isConnected && friend?._id && (
              <div className="panel panel-default">
                <div className="panel-heading">
                  <h4>
                    {t('Edit message for {{name}}:', {
                      name: friend.displayName,
                    })}
                  </h4>
                </div>
                <div className="panel-body">
                  <div className="contact-message">
                    <TrEditor onChange={setMessage} text={message} />
                  </div>
                </div>
              </div>
            )}

            {success && (
              <div className="alert alert-success">
                <h4>{success}</h4>
                <p>
                  <strong>
                    <a href={`/profile/${user.username}`}>{user.displayName}</a>
                  </strong>{' '}
                  &amp;{' '}
                  <strong>
                    <a href={`/profile/${friend?.username}`}>
                      {friend?.displayName}
                    </a>
                  </strong>
                  .
                </p>
              </div>
            )}
            {error && (
              <div className="alert alert-danger text-center">
                <strong>{error}</strong>
              </div>
            )}

            {!isConnected && friend?._id && (
              <p className="text-center">
                <button
                  type="submit"
                  className="btn btn-lg btn-primary"
                  disabled={isLoading}
                >
                  {isLoading ? t('Wait a moment…') : t('Add contact')}
                </button>
                <br />
                <br />
                <a href={`/profile/${friend.username}`} className="text-muted">
                  {t('Cancel')}
                </a>
              </p>
            )}
          </div>
        </div>
      </form>
    </section>
  );
}

ContactAddPage.propTypes = {
  user: PropTypes.object.isRequired,
};
