// External dependencies
import { withTranslation } from 'react-i18next';
import React from 'react';
import type { Offer } from '../api/offers.api';

// Internal dependencies
import '@/config/client/i18n';
import { Button } from '@trustroots/ui/Button';
import MeetingAvailabilityControl from './MeetingAvailabilityControl';
import type { MeetingStatus } from '../../shared/offer';
import OfferStatusButton from './OfferStatusButton';
import OfferLocation from './OfferLocation.component';
import ReadMorePanel from '@/modules/core/client/components/ReadMorePanel';

interface OffersPresentationalProps {
  isOwnOffer: boolean;
  isUserPublic: boolean;
  offer: Offer;
  username?: string;
  onMeetingStatusChange?: (status: MeetingStatus) => void;
  isSavingMeeting?: boolean;
  meetingError?: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
}

export function OffersPresentational(props: OffersPresentationalProps) {
  function isHosting() {
    const { offer } = props;
    return offer?.status === 'yes' || offer?.status === 'maybe';
  }

  function renderHostingYesMaybe() {
    const { offer, isOwnOffer, t } = props;
    const maxGuests = offer.maxGuests ?? 0;
    return (
      <>
        {/* Edit button */}
        {isOwnOffer && (
          <Button
            aria-label={t('Modify hosting offer')}
            variant="outline"
            intent="primary"
            round
            className="pull-right tw:shadow-[0_1px_4px_rgba(0,0,0,0.2)] tw:hover:shadow-none"
            render={<a href="/offer/host" />}
          >
            <span className="icon-edit"></span>
          </Button>
        )}
        {offer.volunteering === true && <p>{t('Offers volunteering')}</p>}
        <ReadMorePanel
          content={offer.description ?? ''}
          id="offer-yes-description"
        />
        {/* Number of guests */}
        <p className="offer-restrictions">
          {maxGuests > 0
            ? t('At most {{count}} guests.', { count: maxGuests })
            : t('No guests.')}
        </p>
      </>
    );
  }

  function renderHostingNo() {
    const { isOwnOffer, offer, t } = props;
    return (
      <>
        {/* Edit button */}
        {isOwnOffer && (
          <Button
            aria-label={t('Modify hosting offer')}
            variant="outline"
            intent="primary"
            round
            className="pull-right tw:shadow-[0_1px_4px_rgba(0,0,0,0.2)] tw:hover:shadow-none"
            render={<a href="/offer/host" />}
          >
            <span className="icon-edit"></span>
          </Button>
        )}

        {/* User has written explanation */}
        {offer.noOfferDescription && (
          <ReadMorePanel
            content={offer.noOfferDescription}
            id="offer-no-description"
          />
        )}
        {/* Default "sorry nope" */}
        {!offer.noOfferDescription && (
          <div className="content-empty text-muted">
            <div className="icon-sofa icon-3x text-muted"></div>

            {/* Show for others */}
            {!isOwnOffer && (
              <h4>{t('Sorry, user is not hosting currently.')}</h4>
            )}

            {/* Show for the user */}
            {isOwnOffer && (
              <p className="lead">
                <br />
                <em>
                  {t(
                    'Offering hospitality and welcoming “strangers” to our homes strengthens our faith in each other.',
                  )}
                </em>
                <br />
              </p>
            )}
          </div>
        )}

        {/* Start hosting and meet people action buttons */}
        {isOwnOffer && !isHosting() && (
          <div className="text-center">
            <br />
            <hr className="hr-gray hr-tight hr-xs" />
            <Button
              variant="outline"
              intent="primary"
              render={<a href={'/offer/host?status=yes'} />}
            >
              {t('Start hosting travellers')}
            </Button>
            &nbsp;
            <Button
              variant="outline"
              intent="primary"
              render={<a href={'/offer/meet'} />}
            >
              {t('Meet people')}
            </Button>
          </div>
        )}
      </>
    );
  }

  function renderOffer() {
    const { t } = props;
    const { isOwnOffer, offer, username } = props;
    return (
      <>
        {(isOwnOffer ||
          (offer.meetingStatus && offer.meetingStatus !== 'not-set')) && (
          <div className="panel panel-default offer-meeting-status">
            {isOwnOffer ? (
              <>
                {props.onMeetingStatusChange ? (
                  <MeetingAvailabilityControl
                    value={offer.meetingStatus ?? 'not-set'}
                    onChange={props.onMeetingStatusChange}
                    disabled={props.isSavingMeeting}
                  />
                ) : (
                  <a href="/offer/host#location">
                    {t(
                      'Are you open to meeting people? Set your location and availability.',
                    )}
                  </a>
                )}
                {props.isSavingMeeting && (
                  <span className="sr-only" role="status">
                    {t('Saving…')}
                  </span>
                )}
                {props.meetingError && (
                  <span role="alert">
                    {t(
                      'Could not save meeting availability. Please try again.',
                    )}
                  </span>
                )}
              </>
            ) : (
              <span>
                {offer.meetingStatus === 'yes'
                  ? t('{{username}} wants to meet people!', {
                      username: username || t('This member'),
                    })
                  : offer.meetingStatus === 'maybe'
                    ? t('{{username}} is maybe up for meeting', {
                        username: username || t('This member'),
                      })
                    : t('{{username}} is too busy to meet people', {
                        username: username || t('This member'),
                      })}
              </span>
            )}
          </div>
        )}
        <div className="panel panel-default offer-view">
          <div className="panel-heading">
            {t('Accommodation')}
            <OfferStatusButton
              isOwnOffer={isOwnOffer}
              status={offer?.status}
              username={username}
            />
          </div>

          {/* Show offer */}
          <div className="panel-body">
            {/* Hosting: yes | maybe */}
            {isHosting() && renderHostingYesMaybe()}

            {/* Hosting: no */}
            {!isHosting() && renderHostingNo()}
          </div>
          {(isHosting() ||
            offer.meetingStatus === 'yes' ||
            offer.meetingStatus === 'maybe') &&
            offer.location?.length === 2 && (
              <div className="offer-location-section">
                <div className="offer-location-heading">
                  <span>
                    {isHosting()
                      ? t('Approximate hosting location')
                      : t('Approximate meeting location')}
                  </span>
                  {isOwnOffer && (
                    <a href="/offer/host#location">{t('Edit location')}</a>
                  )}
                </div>
                <OfferLocation
                  height={220}
                  location={offer.location}
                  offerStatus={isHosting() ? offer.status : 'yes'}
                  offerType={isHosting() ? 'host' : 'meet'}
                />
              </div>
            )}
        </div>
      </>
    );
  }

  return (props.isOwnOffer || props.isUserPublic) && renderOffer();
}

export default withTranslation(['offers'])(OffersPresentational);
