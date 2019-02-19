import React, { Component } from 'react';
import classnames from 'classnames';
import { withNamespaces } from '@/modules/core/client/utils/i18n-angular-load';
import '@/config/lib/i18n';
import { limitTo, sanitizeHtml } from '../../../utils/filters';

// import PropTypes from 'prop-types';

export class Offers extends Component {
  constructor(props) {
    super(props);
    this.renderOffer = this.renderOffer.bind(this);
    this.state = {
      offerDescriptionToggle = false
    };
  }

  setOfferDescriptionToggle(state) {
    this.setState((prevState) => ({
      offerDescriptionToggle: state // !prevState.offerDescriptionToggle
    })
    );
  }

  renderButtonOwn() {
    return(
      <div
        className="pull-right btn-group"
        uib-dropdown
        is-open="hostingDropdown">
        <button className="btn btn-sm dropdown-toggle btn-offer-hosting"
                uib-tooltip="Change"
                tooltip-placement="left"
                uib-dropdown-toggle
                className={classnames({
                  'btn-offer-hosting-yes': trOfferHost.offer.status === 'yes',
                  'btn-offer-hosting-maybe': trOfferHost.offer.status === 'maybe',
                  'btn-offer-hosting-no': (!trOfferHost.offer || trOfferHost.offer.status === 'no')
                })}>
          { trOfferHost.hostingStatusLabel(trOfferHost.offer.status) }
          <span className="caret"></span>
        </button>
        <ul className="dropdown-menu" role="menu">
          <li>
            <a ui-sref="offer.host.edit({'status': 'yes'})"
                className="cursor-pointer offer-hosting-yes">
              I can host
            </a>
          </li>
          <li>
            <a ui-sref="offer.host.edit({'status': 'maybe'})"
                className="cursor-pointer offer-hosting-maybe">
              I might be able to host
            </a>
          </li>
          <li>
            <a ui-sref="offer.host.edit({'status': 'no'})"
                className="cursor-pointer offer-hosting-no">
              I can't host currently
            </a>
          </li>
        </ul>
      </div>
    );
  }

  renderButtonOther() {
    return(
      <a className="btn btn-sm pull-right btn-offer-hosting btn-offer-hosting-yes"
        aria-label="Hosting status: {{ ::trOfferHost.hostingStatusLabel(trOfferHost.offer.status) }}"
        ui-sref="messageThread({username: trOfferHost.profile.username})"
        className={classnames({
          'btn-offer-hosting-no': !trOfferHost.offer || trOfferHost.offer.status === 'no',
          'btn-offer-hosting-yes': trOfferHost.offer.status === 'yes',
          'btn-offer-hosting-maybe': trOfferHost.offer.status === 'maybe'
        })}>
        { trOfferHost.hostingStatusLabel(trOfferHost.offer.status) }
      </a>
    );
  }

  renderHostingYesMaybe() {
    return(
      <div>
        {/*  Edit button  */}
        {trOfferHost.isOwnOffer &&
          <a ui-sref="offer.host.edit"
              className="btn btn-inverse-primary btn-round btn-raised pull-right"
              aria-label="Modify hosting offer">
            <span className="icon-edit"></span>
          </a>
        }

        {/*  Short descriptions  */}
        {(trOfferHost.offer.description && trOfferHost.offer.description.length < 2000) && 
          <div dangerouslySetInnerHTML={{ __html: htmlSanitize(trOfferHost.offer.description) }}>
          </div>
        }

        {/*  Long descriptions  */}
        {trOfferHost.offer.description && trOfferHost.offer.description.length >= 2000 &&
          <div>
            {!trOfferHost.offerDescriptionToggle &&
              <div className="panel-more-wrap">
                <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(limitTo(trOfferHost.offer.description), 2000) }}
                  className="panel-more-excerpt"
                  onClick={this.setOfferDescriptionToggle(true)}> // TODO - change or set true
                </div>
                <div className="panel-more-fade"
                  onClick={this.setOfferDescriptionToggle(true)}>
                  Show more...
                </div>
              </div>
            }
            {trOfferHost.offerDescriptionToggle &&
              <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(trOfferHost.offer.description) }}>
              </div>
            }
          </div>
        }

        <p className="offer-restrictions">
        {/* TODO
          {trOfferHost.offer.maxGuests, plural, offset:1
              =0    {No guests.}
              =1    {At most one guest.}
              other {At most {{ trOfferHost.offer.maxGuests }} guests.}
          } */}
        </p>
      </div>
    );
  }

  renderHostingNo() {
    return(
      <div>
      {/*  Edit button  */}
      {isOwnOffer &&
        <a ui-sref="offer.host.edit({'status': 'no'})"
            className="btn btn-inverse-primary btn-round btn-raised pull-right"
            aria-label="Modify hosting offer">
          <span className="icon-edit"></span>
        </a>
      }

      {/*  User has written explanation  */}
      {trOfferHost.offer.noOfferDescription &&
        <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(trOfferHost.offer.noOfferDescription) }}>
        </div>
      }
      {/*  Default "sorry nope"  */}
      {!trOfferHost.offer.noOfferDescription &&
        <div className="content-empty text-muted">
          <div className="icon-sofa icon-3x text-muted"></div>

          {/*  Show for others  */}
          {!trOfferHost.isOwnOffer &&
            <h4>
              Sorry, user is not hosting currently.
            </h4>
          }

          {/*  Show for the user  */}
          {trOfferHost.isOwnOffer &&
            <div>
              <br />
              <p className="lead">
                <em>Offering hospitality and welcoming “strangers” to our homes strengthens our faith in each other.</em>
              </p>
              <br />
            </div>
          }
        </div>
      }

      {/*  Action button  */}
      {trOfferHost.isOwnOffer && (!trOfferHost.offer.status || trOfferHost.offer.status === 'no') &&
        <div className="text-center">
          <br />
          <hr className="hr-gray hr-tight hr-xs" />
          <a ui-sref="offer.host.edit({status: 'yes'})"
              className="btn btn-inverse-primary">
            Start hosting travellers
          </a>
          &nbsp;
          <a ui-sref="offer.meet.list"
              className="btn btn-inverse-primary">
            Meet people
          </a>
        </div>
      }
     </div>
    );
  }

  renderMap() {
    return(
      <div> {/* / TODO change later to <> */}
        {(trOfferHost.offer.status === 'yes' || trOfferHost.offer.status === 'maybe') &&
          <offer-location offer="trOfferHost.offer">
          </offer-location>
        }
        {(trOfferHost.offer.status === 'yes' || trOfferHost.offer.status === 'maybe') &&
        <div className="panel-footer text-center">
          <a ui-sref="search.map({offer: trOfferHost.offer._id})"
              className="btn btn-sm btn-inverse-primary">
            Bigger map
          </a>
          {trOfferHost.isMobile &&
          <a href="geo:{{trOfferHost.offer.location[0]}},{{trOfferHost.offer.location[1]}};u=200"
              className="btn btn-sm btn-inverse-primary">
            Open on device
          </a>
          }
        </div>
        }
      </div>
    );
  }

  renderOffer() {
    return(
      <div className="panel panel-default offer-view">
        <div className="panel-heading">
          Accommodation
         {/*  Button + dropdown for user's own profile  */}
         {isOwnOffer && this.renderButtonOwn()}
         {/*  Button for other profiles  */}
         {!isOwnOffer && this.renderButtonOther()}
        </div>

        {/*  Show offer  */}
        <div className="panel-body">
        {/*  Hosting: yes | maybe  */}
        {(trOfferHost.offer.status && trOfferHost.offer.status !== 'no') && this.renderHostingYesMaybe()}

        {/*  Hosting: no  */}
        {(!trOfferHost.offer || !trOfferHost.offer.status || trOfferHost.offer.status === 'no') && this.renderHostingNo()}
        </div>

        {/*  The map (React component)  */}
        {this.renderMap()}
      </div>
    );
  };

  render(){
    const { isOwnOffer, isUserPublic } = this.props;
    return ( <>
      { (isOwnOffer || isUserPublic) &&
        this.renderOffer() }
      </>
    );
  }
};

Offers.propTypes = {
  isOwnOffer: PropTypes.bool,
};

export default withNamespaces(['user-profile'])(Offers);