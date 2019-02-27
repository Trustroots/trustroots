import React, { Component } from 'react';
import { Button, DropdownButton, MenuItem, ButtonGroup, Tooltip } from 'react-bootstrap';
import { withNamespaces } from '@/modules/core/client/utils/i18n-angular-load';
import '@/config/lib/i18n';
import { limitTo, sanitizeHtml } from '../../../utils/filters';
import OfferLocation from './OfferLocation.component';

import PropTypes from 'prop-types';

export class Offers extends Component {
  constructor(props) {
    super(props);
    this.renderOffer = this.renderOffer.bind(this);
    this.renderButtonOwn = this.renderButtonOwn.bind(this);
    this.renderHostingYesMaybe = this.renderHostingYesMaybe.bind(this);
    this.setOfferDescriptionToggle = this.setOfferDescriptionToggle.bind(this);
    this.state = {
      offerDescriptionToggle: false,
      offer: {},
      isLoading: true,
      isOwnOffer: false,
      profile: false,
      isUserPublic: false,
      isMobile: window.navigator.userAgent.toLowerCase().indexOf('mobile') >= 0 || window.isNativeMobileApp // TODO check userAgent
    }
  }

  setOfferDescriptionToggle(toggleState) {
    console.log('state');
    return () => {
      console.log('in state', toggleState);
      this.setState(() => ({ offerDescriptionToggle: toggleState }), console.log(this.state));
    };
  }

  guestNumberDescription(guestNumber) {
    switch (guestNumber){
      case 0: return 'No guests.';
      case 1: return 'At most one guest.';
      default: return `At most ${guestNumber} guests.`;
    }
  }

  hostingStatusLabel (status) {
    switch (status) {
      case 'yes': return 'Can host';
      case 'maybe': return 'Might be able to host';
      default: return 'Cannot host currently';
    }
  }

  componentDidMount() {
    const that = this;
    const { profile, authUser } = this.props;
    if (!profile) {
      this.setState(() => ({
        isLoading: false
      }));
      return;
    }
    if (profile._id) {
      that.setState(() => ({
        profile: profile,
        isOwnOffer: (authUser && authUser._id && authUser._id === profile._id),
        isUserPublic: (authUser && authUser.public)
      }));

      // TODO fetch offer data
      fetch(`/api/offers-by/${profile._id}`,{
        method: 'GET'
      })
        .then(response => response.json())
        .then(offers => {
          if (!offers || !offers.length) {
            this.setState(() => ({
              isLoading: false
            })
            );
          } else {
            const off = offers[0];
            that.setState(() => ({
              offer: off,
              isLoading: false
            }));
          }
        });
    }
  }

  renderButtonOwn() {
    const { offer } = this.state;
    const tooltip = (<Tooltip placement="left" className="in" id="tooltip-left">
    Change
    </Tooltip>);
    {/* Hosting status dropdown logged in user */}
    return (
      <ButtonGroup className="pull-right dropdown-menu-offers">
        <DropdownButton
          pullRight
          className={`btn-offer-hosting, btn-offer-hosting-${offer.status}`}
          bsSize="small"
          bsStyle="success"
          title={this.hostingStatusLabel(offer.status)}
          id={'dropdown-offers-button'}
          overlay={tooltip}
        >
          <MenuItem eventKey="1" className="cursor-pointer offer-hosting-yes">
            {/* ui-sref="offer.host.edit({'status': 'yes'})" */}
            I can host
          </MenuItem>
          <MenuItem eventKey="2" className="cursor-pointer offer-hosting-maybe">
            {/* ui-sref="offer.host.edit({'status': 'maybe'})" */}
            I might be able to host
          </MenuItem>
          <MenuItem eventKey="3" className="cursor-pointer offer-hosting-no">
            {/* ui-sref="offer.host.edit({'status': 'no'})" */}
            {'I can\'t host currently'}
          </MenuItem>
        </DropdownButton>
      </ButtonGroup>);
  }

  renderButtonOther() {
    const { offer } = this.state;
    {/* Hosting status button other user */}
    return (
      <Button className={`btn-offer-hosting, btn-offer-hosting-${offer.status}, pull-right`}
        aria-label={`Hosting status: ${hostingStatusLabel(offer.status)}`}
        bsSize="small"
        bsStyle="success"
        id={'offers-button'}
      >
        {/* ui-sref="messageThread({username: profile.username})" */}
        {this.hostingStatusLabel(offer.status)}
      </Button>
    );
  }

  renderHostingYesMaybe() {
    const { offer, offerDescriptionToggle, isOwnOffer } = this.state;
    return (
      <div>
        {/*  Edit button  */}
        {/* ui-sref="offer.host.edit" */}
        {isOwnOffer &&
          <a className="btn btn-inverse-primary btn-round btn-raised pull-right"
            aria-label="Modify hosting offer">
            <span className="icon-edit"></span>
          </a>
        }

        {/*  Short descriptions  */}
        {(offer.description && offer.description.length < 2000) &&
          <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(offer.description) }}>
          </div>
        }

        {/*  Long descriptions  */}
        {offer.description && offer.description.length >= 2000 &&
          <div>
            {!offerDescriptionToggle &&
              <div className="panel-more-wrap">
                <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(limitTo(offer.description, 2000)) }}
                  className="panel-more-excerpt"
                  onClick={this.setOfferDescriptionToggle(true)}>
                </div>
                <div className="panel-more-fade"
                  onClick={this.setOfferDescriptionToggle(true)}>
                  Show more...
                </div>
              </div>
            }
            {this.state.offerDescriptionToggle &&
              <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(offer.description) }}>
              </div>
            }
          </div>
        }
        {/* Number of guests */}
        <p className="offer-restrictions">
          {this.guestNumberDescription(offer.maxGuests)}
        </p>
      </div>
    );
  }

  renderHostingNo() {
    const {isOwnOffer, offer} = this.state;
    return (
      <div>
        {/*  Edit button  */}
        {/* ui-sref="offer.host.edit({'status': 'no'})" */}
        {isOwnOffer &&
        <a className="btn btn-inverse-primary btn-round btn-raised pull-right"
          aria-label="Modify hosting offer">
          <span className="icon-edit"></span>
        </a>
        }

        {/*  User has written explanation  */}
        {offer.noOfferDescription &&
        <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(offer.noOfferDescription) }}>
        </div>
        }
        {/*  Default "sorry nope"  */}
        {!offer.noOfferDescription &&
        <div className="content-empty text-muted">
          <div className="icon-sofa icon-3x text-muted"></div>

          {/*  Show for others  */}
          {!isOwnOffer &&
            <h4>
              Sorry, user is not hosting currently.
            </h4>
          }

          {/*  Show for the user  */}
          {isOwnOffer &&
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

        {/*  Start hosting and meet people action buttons  */}
        {isOwnOffer && (!offer.status || offer.status === 'no') &&
        <div className="text-center">
          <br />
          <hr className="hr-gray hr-tight hr-xs" />
          {/* "offer.host.edit({status: 'yes'})" */}
          <a className="btn btn-inverse-primary">
            Start hosting travellers
          </a>
          &nbsp;
          {/* ui-sref="offer.meet.list" */}
          <a className="btn btn-inverse-primary">
            Meet people
          </a>
        </div>
        }
      </div>
    );
  }

  renderMap() {
    const {offer, isMobile} = this.state;
    return (
      <div>
      <div> {/* / TODO change later to <> */}
        {(offer.status === 'yes' || offer.status === 'maybe') &&
          <OfferLocation offer={offer} ></OfferLocation>
        }
        {(offer.status === 'yes' || offer.status === 'maybe') &&
        <div className="panel-footer text-center">
          {/* ui-sref="search.map({offer: offer._id})" */}
          <a className="btn btn-sm btn-inverse-primary">
            Bigger map
          </a>
          {isMobile &&
          <a href="geo:{{offer.location[0]}},{{offer.location[1]}};u=200"
            className="btn btn-sm btn-inverse-primary">
            Open on device
          </a>
          }
        </div>
        }
      </div>
      </div>
    );
  }

  renderOffer() {
    const { isOwnOffer, offer } = this.state;
    return (
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
          {(offer.status && offer.status !== 'no') && this.renderHostingYesMaybe()}

          {/*  Hosting: no  */}
          {(!offer || !offer.status || offer.status === 'no') && this.renderHostingNo()}
        </div>

        {/*  The map (React component)  */}
        {this.renderMap()}
      </div>
    );
  };

  render(){
    return (this.state.isOwnOffer || this.state.isUserPublic) &&
        this.renderOffer()
  }
};

Offers.propTypes = {
  authUser: PropTypes.object.isRequired,
  profile: PropTypes.object.isRequired
};

export default withNamespaces(['user-profile'])(Offers);
