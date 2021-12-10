// External dependencies
import { useTranslation } from 'react-i18next';
import classnames from 'classnames';
import PropTypes from 'prop-types';
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';

// Internal dependencies
import { get, send } from '../api/reference-thread.api';
import TimeAgo from '@/modules/core/client/components/TimeAgo';

const ChangeButton = styled.button`
  display: inline;
  margin: 0;
  padding: 0;
  color: #999;
`;

export default function ReferenceThread({ userToId }) {
  const { t } = useTranslation('messages');
  const [isAsking, setIsAsking] = useState(true);
  const [referenceThread, setReferenceThread] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [allowCreatingReference, setAllowCreatingReference] = useState(true);

  const question = t(
    'Do you find messages from this person to be polite, respectful and in the spirit of Trustroots?',
  );

  const answer = async value => {
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

  useEffect(async () => {
    try {
      const reference = await get(userToId);
      if (reference) {
        setIsAsking(false);
        setReferenceThread(reference);
      }
    } catch (error) {
      if (error.response?.status === 404) {
        setAllowCreatingReference(
          error.response?.data?.allowCreatingReference ?? false,
        );
      } else {
        // Unknown error
        allowCreatingReference(false);
      }
    } finally {
      setIsLoading(false);
    }
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
                {t('Yes')}
              </button>
              <button className="btn btn-default" onClick={() => answer('no')}>
                {t('No')}
              </button>
            </div>
          </>
        )}
        {!isAsking && (
          <>
            <p className="text-muted">{question}</p>
            <p
              className={classnames({
                'text-danger': referenceThread.reference === 'no',
                'text-muted': referenceThread.reference === 'yes',
              })}
            >
              <em>
                {referenceThread.reference === 'yes' && t('Yes')}
                {referenceThread.reference === 'no' && t('No')}
              </em>
            </p>
            <p className="text-muted">
              <TimeAgo date={referenceThread.created} />
              {' · '}
              <ChangeButton
                className="btn btn-link"
                onClick={() => setIsAsking(true)}
              >
                {t('Change')}
              </ChangeButton>
            </p>
          </>
        )}
      </div>
      {isAsking && (
        <div className="panel-footer">
          <small className="text-muted">
            {t("Your response won't be visible to them.")}
          </small>
        </div>
      )}
    </div>
  );
}

ReferenceThread.propTypes = {
  userToId: PropTypes.string.isRequired,
};
