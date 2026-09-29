import React from 'react';
import PropTypes from 'prop-types';
import { Trans, useTranslation } from 'react-i18next';
import '@/config/client/i18n';
import Avatar from '@/modules/users/client/components/Avatar.component';
import type { ContactListEntry } from '../types';

type ContactSituation = 'confirmed' | 'unconfirmedFromMe' | 'unconfirmedToMe';

export default function ContactPresentational({
  className,
  contact,
  avatarSize = 128,
  hideMeta = false,
  situation,
  onClickRemove,
}: {
  className?: string;
  contact: ContactListEntry;
  avatarSize?: number;
  hideMeta?: boolean;
  situation: ContactSituation;
  onClickRemove: () => void;
}) {
  const { t } = useTranslation('contacts') as {
    t: (key: string, options?: Record<string, unknown>) => string;
  };

  const { username, displayName, locationFrom, locationLiving } = contact.user;
  return (
    <div className={className}>
      <Avatar user={contact.user} size={avatarSize} />
      <h4>
        <a href={`/profile/${username}`}>{displayName}</a>
      </h4>
      {locationLiving && (
        <div>
          <i className="icon-fw icon-building text-muted"></i>
          <small>
            {/* @TODO remove ns (issue #1368) */}
            <Trans ns="contacts" values={{ locationLiving }}>
              Lives in{' '}
              <a href={`/search?location=${locationLiving}`}>
                {locationLiving}
              </a>
            </Trans>
          </small>
        </div>
      )}
      {locationFrom && (
        <div>
          <i className="icon-fw icon-home text-muted"></i>
          <small>
            {/* @TODO remove ns (issue #1368) */}
            <Trans ns="contacts" values={{ locationFrom }}>
              From{' '}
              <a href={`/search?location=${locationFrom}`}>{locationFrom}</a>
            </Trans>
          </small>
        </div>
      )}
      {!hideMeta && (
        <small className="text-muted">
          {contact.confirmed === true &&
            (t('Since {{created, LL}}', {
              created: new Date(contact.created || ''),
            }) as string)}
          {contact.confirmed === false &&
            (t('Requested {{created, LL}}', {
              created: new Date(contact.created || ''),
            }) as string)}
        </small>
      )}
      {/* Authenticated user requested this connection */}
      {situation === 'unconfirmedFromMe' && (
        <div className="contact-confirm">
          <small className="text-warning">
            <em>{t('Contact request sent and pending.') as string}</em>
          </small>
          <a className="btn btn-xs btn-primary" onClick={onClickRemove}>
            {t('Revoke Request') as string}
          </a>
        </div>
      )}
      {/* Authenticated user received this request */}
      {situation === 'unconfirmedToMe' && (
        <div className="contact-confirm">
          <small>
            <em>{t('You received a contact request.') as string}</em>
          </small>
          <a
            className="btn btn-xs btn-primary"
            href={`/contact-confirm/${contact._id}`}
          >
            {t('Confirm Request') as string}
          </a>
          <a className="btn btn-xs btn-warn" onClick={onClickRemove}>
            {t('Decline Request') as string}
          </a>
        </div>
      )}
    </div>
  );
}

ContactPresentational.propTypes = {
  className: PropTypes.string,
  contact: PropTypes.object.isRequired,
  avatarSize: PropTypes.number,
  situation: PropTypes.string.isRequired,
  hideMeta: PropTypes.bool,
  onClickRemove: PropTypes.func.isRequired,
};
