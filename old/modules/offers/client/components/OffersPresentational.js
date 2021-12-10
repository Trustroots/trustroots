// External dependencies
import { withTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import React, { Component } from 'react';

// Internal dependencies
import '@/config/client/i18n';
import OfferLocation from './OfferLocation.component';
import OfferStatusButton from './OfferStatusButton';
import ReadMorePanel from '@/modules/core/client/components/ReadMorePanel';

export class OffersPresentational extends Component {
  constructor(props) {
    super(props);
    this.renderOffer = this.renderOffer.bind(this);
    this.renderHostingYesMaybe = this.renderHostingYesMaybe.bind(this);
    this.state = {
      isLoading: true,
      isMobile:
        window.navigator.userAgent.toLowerCase().indexOf('mobile') >= 0 ||
        window.isNativeMobileApp,
    };
  }

  isHosting() {
    const { offer } = this.props;
    return offer?.status === 'yes' || offer?.status === 'maybe';
  }

  renderHostingYesMaybe() {
    const { offer, isOwnOffer, t } = this.props;
    return (
      <>
        {/* Edit button */}
        {isOwnOffer && (
          <a
            aria-label={t('Modify hosting offer')}
            className="btn btn-inverse-primary btn-round btn-raised pull-right"
            href="/offer/host"
          >
            <span className="icon-edit"></span>
          </a>
        )}
        <ReadMorePanel content={offer.description} id="offer-yes-description" />
        {/* Number of guests */}
        <p className="offer-restrictions">
          {offer.maxGuests > 0
            ? t('At most {{count}} guests.', { count: offer.maxGuests })
            : t('No guests.')}
        </p>
      </>
    );
  }

  renderHostingNo() {
    const { isOwnOffer, offer, t } = this.props;
    return (
      <>
        {/* Edit button */}
        {isOwnOffer && (
          <a
            aria-label={t('Modify hosting offer')}
            className="btn btn-inverse-primary btn-round btn-raised pull-right"
            href="/offer/host"
          >
            <span className="icon-edit"></span>
          </a>
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
        {isOwnOffer && !this.isHosting() && (
          <div className="text-center">
            <br />
            <hr className="hr-gray hr-tight hr-xs" />
            <a
              href={'/offer/host?status=yes'}
              className="btn btn-inverse-primary"
            >
              {t('Start hosting travellers')}
            </a>
            &nbsp;
            <a href={'/offer/meet'} className="btn btn-inverse-primary">
              {t('Meet people')}
            </a>
          </div>
        )}
      </>
    );
  }

  renderMap() {
    const { isMobile } = this.state;
    const { offer, t } = this.props;
    return (
      <>
        {this.isHosting() && (
          <OfferLocation
            location={offer.location}
            offerType={offer.type}
            offerStatus={offer.status}
          />
        )}
        {this.isHosting() && (
          <div className="panel-footer text-center">
            <a
              className="btn btn-sm btn-inverse-primary"
              href={`/search?offer=${offer._id}`}
            >
              {t('Bigger map')}
            </a>
            {isMobile && (
              <a
                className="btn btn-sm btn-inverse-primary"
                href={`geo:${offer.location[0]},${offer.location[1]};u=200`}
              >
                {t('Open on device')}
              </a>
            )}
          </div>
        )}
      </>
    );
  }

  renderOffer() {
    const { t } = this.props;
    const { isOwnOffer, offer, username } = this.props;
    return (
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
          {this.isHosting() && this.renderHostingYesMaybe()}

          {/* Hosting: no */}
          {!this.isHosting() && this.renderHostingNo()}
        </div>

        {/* The map (React component) */}
        {this.renderMap()}
      </div>
    );
  }

  render() {
    return (
      (this.props.isOwnOffer || this.props.isUserPublic) && this.renderOffer()
    );
  }
}

OffersPresentational.propTypes = {
  isOwnOffer: PropTypes.bool.isRequired,
  isUserPublic: PropTypes.bool.isRequired,
  offer: PropTypes.object.isRequired,
  username: PropTypes.string,
  t: PropTypes.func,
};

export default withTranslation(['offers'])(OffersPresentational);
