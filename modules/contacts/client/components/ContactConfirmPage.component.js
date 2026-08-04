import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import ActivateProfileNotice from '@/modules/users/client/components/ActivateProfileNotice.component';
import Avatar from '@/modules/users/client/components/Avatar.component';
import * as contactsApi from '@/modules/contacts/client/api/contacts.api';
import { getCurrentRouteParams } from '@/modules/core/client/services/client-runtime';
import LoadingIndicator from '@/modules/core/client/components/LoadingIndicator';

export default function ContactConfirmPage({ user }) {
  const { t } = useTranslation('contacts');
  const { contactId } = getCurrentRouteParams();
  const [contact, setContact] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [isWrongCode, setIsWrongCode] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadContact() {
      if (!contactId) {
        setError(t('Something went wrong. Try again.'));
        setIsFetching(false);
        return;
      }

      try {
        const loadedContact = await contactsApi.getByContactId(contactId);

        if (!isMounted) {
          return;
        }

        setContact(loadedContact);

        if (loadedContact.confirmed) {
          setIsConnected(true);
          setSuccess(t('You two are already connected. Great!'));
        } else if (loadedContact.userTo._id !== user._id) {
          setError(t('You must wait until they confirm your connection.'));
        }
      } catch (requestError) {
        if (!isMounted) {
          return;
        }

        setIsWrongCode(true);
        setError(
          requestError.response?.status === 404
            ? t(
                'Could not find contact request. Check the confirmation link from email or you might be logged in with wrong user?',
              )
            : t('Something went wrong. Try again.'),
        );
      } finally {
        if (isMounted) {
          setIsFetching(false);
        }
      }
    }

    loadContact();

    return () => {
      isMounted = false;
    };
  }, [contactId, t, user._id]);

  async function handleConfirm(event) {
    event.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await contactsApi.confirm(contactId);
      setSuccess(t('You two are now connected!'));
      setIsConnected(true);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          t('Something went wrong. Try again.'),
      );
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

  const canConfirm =
    contact && !isConnected && !isWrongCode && contact.userTo._id === user._id;

  return (
    <section className="container container-spacer">
      <form onSubmit={handleConfirm} autoComplete="off">
        <div className="row">
          <div className="col-xs-12 col-sm-offset-1 col-sm-10 col-md-offset-2 col-md-8 col-lg-offset-3 col-lg-6">
            <div className="page-header">
              <h2>{t('Confirm contact')}</h2>
            </div>

            {isFetching && <LoadingIndicator />}

            {canConfirm && (
              <div className="panel panel-default contacts-connection">
                <div className="panel-body">
                  <div className="row">
                    <div className="col-xs-12 col-sm-5 contacts-connection-profile">
                      <Avatar
                        className="center-block"
                        size={128}
                        user={contact.userFrom}
                        link={false}
                      />
                      <h4 className="contacts-connection-name">
                        {contact.userFrom.displayName}
                      </h4>
                    </div>
                    <div className="hidden-xs col-sm-2">
                      <i className="icon-exchange icon-3x text-muted contacts-connection-divider" />
                    </div>
                    <div className="col-xs-12 col-sm-5 contacts-connection-profile">
                      <Avatar
                        className="center-block"
                        size={128}
                        user={contact.userTo}
                        link={false}
                      />
                      <h4 className="contacts-connection-name">
                        {contact.userTo.displayName}
                      </h4>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {success && (
              <div className="alert alert-success">
                <h4>{success}</h4>
                {contact && (
                  <p>
                    <strong>
                      <a href={`/profile/${contact.userFrom.username}`}>
                        {contact.userFrom.displayName}
                      </a>
                    </strong>{' '}
                    &amp;{' '}
                    <strong>
                      <a href={`/profile/${contact.userTo.username}`}>
                        {contact.userTo.displayName}
                      </a>
                    </strong>
                    .
                  </p>
                )}
              </div>
            )}
            {error && (
              <div className="alert alert-danger text-center">
                <strong>{error}</strong>
              </div>
            )}

            {canConfirm && (
              <div className="text-center">
                <button
                  type="submit"
                  className="btn btn-lg btn-primary"
                  disabled={isLoading}
                >
                  {isLoading ? t('Wait a moment…') : t('Confirm contact')}
                </button>
                <br />
                <br />
                <a
                  href={`/profile/${contact.userTo.username}`}
                  className="text-muted"
                >
                  {t('Cancel')}
                </a>
              </div>
            )}
          </div>
        </div>
      </form>
    </section>
  );
}

ContactConfirmPage.propTypes = {
  user: PropTypes.object.isRequired,
};
