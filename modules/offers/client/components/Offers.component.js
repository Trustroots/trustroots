import React, { Component } from 'react';
import classnames from 'classnames';
import { withNamespaces } from '@/modules/core/client/utils/i18n-angular-load';
import '@/config/lib/i18n';
import { limitTo, sanitizeHtml } from '../../../utils/filters';

import PropTypes from 'prop-types';

export class Offers extends Component {
  constructor(props) {
    super(props);
    this.renderOffer = this.renderOffer.bind(this);
    this.state = {
      offerDescriptionToggle: false,
      offer: {},
      isLoading: true,
      isOwnOffer: false,
      profile: false,
      isUserPublic: false,
      hostingDropdown: false,
      hostingStatusLabel: () => (true), //this.hostingStatusLabel,
      isMobile: window.navigator.userAgent.toLowerCase().indexOf('mobile') >= 0 || window.isNativeMobileApp // TODO check userAgent
    }
  }

  componentDidMount() {
    const that = this;
    console.log('MOUNTED');
    const { profile, authUser } = this.props;
    if (!profile) {
      this.setState(() => ({
        isLoading: false
      }));
      return;
    }
    if (profile && profile._id) {
      that.setState(() => ({
        profile: profile,
        isOwnOffer: true,
        //isOwnOffer: 'dfa' //(authUser && authUser._id && authUser._id === profile._id),
        //isUserPublic: (authUser && authUser.public)
      }));

      // TODO fetch offer data
      fetch(`/api/offers-by/${profile._id}`,{
        method: 'GET'
      })
        .then(response => response.json())
        .then(offers => {
          console.log('KOTKI', offers);
          console.log('KOTKI', offers[0]);
          if(!offers || !offers.length) {
            this.setState(() => ({
              isLoading: false
            })
            );
          } else {
            console.log('aha', offers[0]._id);
            console.log('THIS', this);
            console.log('THSI', this.setState)
            const off = offers[0]
            that.setState(() => ({
              offer: off,
              isLoading: false
            }), console.log('STATE INSIDE', this.state))
            console.log('STATE INELSE', this.state)
          }
          console.log('STATE INSIDE', this.state)
        })
      
      //); // setState
        console.log('STATE', this.state)
      // OffersByService.query({
      //   userId: String(profile._id),
      //   types: 'host'
      // }, function (offers) {

      //   if (!offers || !offers.length) {
      //     vm.isLoading = false;
      //     return;
      //   }

      //   vm.offer = offers[0];
      //   vm.isLoading = false;
      // }, function () {
      //   // No offer(s) found
      //   vm.isLoading = false;
      // });
    }
    console.log('STATE', this.state)
  }
  /* @ngInject */

  // function OffersByService($resource) {
  //   return $resource('/api/offers-by/:userId', {
  //     userId: '@id'
  //   }, {
  //     query: {
  //       method: 'GET',
  //       isArray: true
  //     }
  //   });
  // }

  /**
   * Helper for hosting label
   */
  hostingStatusLabel(status) {
    switch (status) {
      case 'yes':
        return 'Can host';
      case 'maybe':
        return 'Might be able to host';
      default:
        return 'Cannot host currently';
    }
  }

  setOfferDescriptionToggle(state) {
    this.setState(() => ({
      offerDescriptionToggle: state // !prevState.offerDescriptionToggle
    })
    );
  }

  renderButtonOwn() {
    const { offer, hostingStatusLabel } = this.state;
    return (
      <div
        className="pull-right btn-group"
        uib-dropdown
        is-open="hostingDropdown">
        <button
          uib-tooltip="Change"
          tooltip-placement="left"
          uib-dropdown-toggle
          className={classnames(
            'btn', 'btn-sm', 'dropdown-toggle', 'btn-offer-hosting',
            { 'btn-offer-hosting-yes': offer.status === 'yes',
              'btn-offer-hosting-maybe': offer.status === 'maybe',
              'btn-offer-hosting-no': (!offer || offer.status === 'no')
            })}>
          { hostingStatusLabel(offer.status) }
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
              {'I can\'t host currently'}
            </a>
          </li>
        </ul>
      </div>
    );
  }

  renderButtonOther() {
    const { offer, hostingStatusLabel } = this.state;
    return (
      <a aria-label="Hosting status: {{ hostingStatusLabel(offer.status) }}"
        ui-sref="messageThread({username: profile.username})"
        className={classnames(
          'btn', 'btn-sm', 'pull-right', 'btn-offer-hosting', 'btn-offer-hosting-yes',
          {
            'btn-offer-hosting-no': !offer || offer.status === 'no',
            'btn-offer-hosting-yes': offer.status === 'yes',
            'btn-offer-hosting-maybe': offer.status === 'maybe'
          })}>
        { hostingStatusLabel(offer.status) }
      </a>
    );
  }

  renderHostingYesMaybe() {
    const { offer, offerDescriptionToggle, isOwnOffer } = this.state;
    return (
      <div>
        {/*  Edit button  */}
        {isOwnOffer &&
          <a ui-sref="offer.host.edit"
            className="btn btn-inverse-primary btn-round btn-raised pull-right"
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
                <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(limitTo(offer.description), 2000) }}
                  className="panel-more-excerpt"
                  onClick={this.setOfferDescriptionToggle(true)}>
                </div>{/* // TODO - change or set true */}
                <div className="panel-more-fade"
                  onClick={this.setOfferDescriptionToggle(true)}>
                  Show more...
                </div>
              </div>
            }
            {offerDescriptionToggle &&
              <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(offer.description) }}>
              </div>
            }
          </div>
        }

        <p className="offer-restrictions">
          {/* TODO
          {offer.maxGuests, plural, offset:1
              =0    {No guests.}
              =1    {At most one guest.}
              other {At most {{ offer.maxGuests }} guests.}
          } */}
        </p>
      </div>
    );
  }

  renderHostingNo() {
    const {isOwnOffer, offer} = this.state;
    return (
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

        {/*  Action button  */}
        {isOwnOffer && (!offer.status || offer.status === 'no') &&
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
    const {offer, isMobile} = this.state;
    return (
      <div> {/* / TODO change later to <> */}
        {(offer.status === 'yes' || offer.status === 'maybe') &&
          <offer-location offer="offer">
          </offer-location>
        }
        {(offer.status === 'yes' || offer.status === 'maybe') &&
        <div className="panel-footer text-center">
          <a ui-sref="search.map({offer: offer._id})"
            className="btn btn-sm btn-inverse-primary">
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
    console.log(this.state);
    console.log('STATERRRRR', this.state)
    return (<>
      { (this.state.isOwnOffer || this.state.isUserPublic) &&
        this.renderOffer(this.state.isOwnOffer) }
      </>
    );
  }
};

Offers.propTypes = {
  authUser: PropTypes.object.isRequired,
  profile: PropTypes.object.isRequired
};

export default withNamespaces(['user-profile'])(Offers);