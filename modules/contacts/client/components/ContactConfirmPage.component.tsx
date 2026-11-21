import React, { useEffect, useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@trustroots/ui/Button';
import ActivateProfileNotice from '@/modules/users/client/components/ActivateProfileNotice.component';
import MemberIdentity from '@/modules/users/client/components/MemberIdentity';
import * as contactsApi from '@/modules/contacts/client/api/contacts.api';
import LoadingIndicator from '@/modules/core/client/components/LoadingIndicator';
import type { ContactConfirmation } from '../types';
import { readApiError } from '@/modules/users/client/utils/api-error';
import type { UserProfile } from '@/modules/users/client/types';
import { Alert } from '@trustroots/ui/Alert';

export default function ContactConfirmPage({ user }: { user: UserProfile }) {
  const { t } = useTranslation('contacts') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };
  const { contactId } = useParams({ strict: false });
  const [contact, setContact] = useState<ContactConfirmation | null>(null);
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
      } catch (requestError: unknown) {
        if (!isMounted) {
          return;
        }

        setIsWrongCode(true);
        setError(
          readApiError(requestError).status === 404
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

  async function handleConfirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await contactsApi.confirm(contactId);
      setSuccess(t('You two are now connected!'));
      setIsConnected(true);
    } catch (requestError: unknown) {
      const { message } = readApiError(requestError);
      setError(message || (t('Something went wrong. Try again.') as string));
    } finally {
      setIsLoading(false);
    }
  }

  if (!user.public) {
    return (
      <section className="tw:page-container container-spacer">
        <ActivateProfileNotice />
      </section>
    );
  }

  const canConfirm =
    contact && !isConnected && !isWrongCode && contact.userTo._id === user._id;

  return (
    <section className="tw:page-container container-spacer">
      <form onSubmit={handleConfirm} autoComplete="off">
        <div className="tw:grid-row">
          <div className="tw:grid-col-12 tw:sm:grid-offset-1 tw:sm:grid-col-10 tw:md:grid-offset-2 tw:md:grid-col-8 tw:lg:grid-offset-3 tw:lg:grid-col-6">
            <div className="page-header">
              <h2>{t('Confirm contact') as string}</h2>
            </div>

            {isFetching && <LoadingIndicator />}

            {canConfirm && (
              <div className="panel panel-default contacts-connection">
                <div className="panel-body">
                  <div className="tw:grid-row">
                    <div className="tw:grid-col-12 tw:sm:grid-col-5">
                      <MemberIdentity user={contact.userFrom} size={64} />
                    </div>
                    <div className="tw:max-sm:hidden tw:sm:grid-col-2">
                      <i className="icon-exchange icon-3x text-muted contacts-connection-divider" />
                    </div>
                    <div className="tw:grid-col-12 tw:sm:grid-col-5 tw:max-sm:mt-2.5">
                      <MemberIdentity user={contact.userTo} size={64} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {success && (
              <Alert intent="success" role="status">
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
              </Alert>
            )}
            {error && (
              <Alert className="tw:text-center" intent="danger" role="alert">
                <strong>{error}</strong>
              </Alert>
            )}

            {canConfirm && (
              <div className="text-center">
                <Button
                  type="submit"
                  intent="primary"
                  size="lg"
                  disabled={isLoading}
                >
                  {isLoading
                    ? (t('Wait a moment…') as string)
                    : (t('Confirm contact') as string)}
                </Button>
                <br />
                <br />
                <a
                  href={`/profile/${contact.userTo.username}`}
                  className="text-muted"
                >
                  {t('Cancel') as string}
                </a>
              </div>
            )}
          </div>
        </div>
      </form>
    </section>
  );
}
