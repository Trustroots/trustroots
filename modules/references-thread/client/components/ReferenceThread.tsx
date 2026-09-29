// External dependencies
import { useTranslation } from 'react-i18next';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';

// Internal dependencies
import {
  get,
  send,
  type ReferenceThreadData,
} from '../api/reference-thread.api';
import TimeAgo from '@/modules/core/client/components/TimeAgo';
import { readApiError } from '@/modules/users/client/utils/api-error';

const ChangeButton = styled.button`
  display: inline;
  margin: 0;
  padding: 0;
  color: #999;
`;

interface ReferenceThreadProps {
  userToId: string;
}

export default function ReferenceThread({ userToId }: ReferenceThreadProps) {
  const { t } = useTranslation('messages') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };
  const [isAsking, setIsAsking] = useState(true);
  const [referenceThread, setReferenceThread] =
    useState<ReferenceThreadData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [allowCreatingReference, setAllowCreatingReference] = useState(true);

  const question = t(
    'Do you find messages from this person to be polite, respectful and in the spirit of Trustroots?',
  ) as string;

  const answer = async (value: 'yes' | 'no') => {
    setReferenceThread({
      reference: value,
      created: new Date(),
    });
    setIsAsking(false);
    try {
      await send(value, userToId);
    } catch {
      setIsAsking(true);
    }
  };

  useEffect(() => {
    const loadReference = async () => {
      try {
        const reference = await get(userToId);
        if (reference) {
          setIsAsking(false);
          setReferenceThread(reference);
        }
      } catch (error: unknown) {
        const apiError = readApiError(error);
        if (apiError.status === 404) {
          setAllowCreatingReference(
            typeof apiError.data.allowCreatingReference === 'boolean'
              ? apiError.data.allowCreatingReference
              : false,
          );
        } else {
          // Unknown error
          setAllowCreatingReference(false);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadReference();
  }, []);

  // Don't allow when there were no messages from other person yet
  if (!allowCreatingReference || isLoading) {
    return null;
  }

  return (
    <div
      className={classnames('panel', 'text-center', {
        'panel-default': isAsking,
        'panel-transparent': !isAsking,
      })}
    >
      <div className="panel-body">
        {isAsking && (
          <>
            <p>{question}</p>
            <div className="btn-group btn-group-lg" role="group">
              <button className="btn btn-default" onClick={() => answer('yes')}>
                {t('Yes') as string}
              </button>
              <button className="btn btn-default" onClick={() => answer('no')}>
                {t('No') as string}
              </button>
            </div>
          </>
        )}
        {!isAsking && (
          <>
            <p className="text-muted">{question}</p>
            <p
              className={classnames({
                'text-danger': referenceThread?.reference === 'no',
                'text-muted': referenceThread?.reference === 'yes',
              })}
            >
              <em>
                {referenceThread?.reference === 'yes' && (t('Yes') as string)}
                {referenceThread?.reference === 'no' && (t('No') as string)}
              </em>
            </p>
            <p className="text-muted">
              <TimeAgo date={new Date(referenceThread?.created || '')} />
              {' · '}
              <ChangeButton
                className="btn btn-link"
                onClick={() => setIsAsking(true)}
              >
                {t('Change') as string}
              </ChangeButton>
            </p>
          </>
        )}
      </div>
      {isAsking && (
        <div className="panel-footer">
          <small className="text-muted">
            {t("Your response won't be visible to them.") as string}
          </small>
        </div>
      )}
    </div>
  );
}

ReferenceThread.propTypes = {
  userToId: PropTypes.string.isRequired,
};
