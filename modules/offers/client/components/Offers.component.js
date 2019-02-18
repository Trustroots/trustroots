import React, { Component } from 'react';
import { withNamespaces } from '@/modules/core/client/utils/i18n-angular-load';
import '@/config/lib/i18n';
// import PropTypes from 'prop-types';

export class Offers extends Component {
  constructor(props) {
    super(props);
    this.renderOffer = this.renderOffer.bind(this);
    this.state = {
    };
  }

  renderButtonOwn() {
    return(
      <div
        class="pull-right btn-group"
        uib-dropdown
        is-open="hostingDropdown">
        <button class="btn btn-sm dropdown-toggle btn-offer-hosting"
                uib-tooltip="Change"
                tooltip-placement="left"
                uib-dropdown-toggle
                ng-class="{
                  'btn-offer-hosting-yes': trOfferHost.offer.status === 'yes',
                  'btn-offer-hosting-maybe': trOfferHost.offer.status === 'maybe',
                  'btn-offer-hosting-no': (!trOfferHost.offer || trOfferHost.offer.status === 'no')
                }">
          { trOfferHost.hostingStatusLabel(trOfferHost.offer.status) }
          <span class="caret"></span>
        </button>
        <ul class="dropdown-menu" role="menu">
          <li>
            <a ui-sref="offer.host.edit({'status': 'yes'})"
                class="cursor-pointer offer-hosting-yes">
              I can host
            </a>
          </li>
          <li>
            <a ui-sref="offer.host.edit({'status': 'maybe'})"
                class="cursor-pointer offer-hosting-maybe">
              I might be able to host
            </a>
          </li>
          <li>
            <a ui-sref="offer.host.edit({'status': 'no'})"
                class="cursor-pointer offer-hosting-no">
              I can't host currently
            </a>
          </li>
        </ul>
      </div>
    );
  }

  renderButtonOther() {
    return(
      <a class="btn btn-sm pull-right btn-offer-hosting btn-offer-hosting-yes"
        aria-label="Hosting status: {{ ::trOfferHost.hostingStatusLabel(trOfferHost.offer.status) }}"
        ui-sref="messageThread({username: trOfferHost.profile.username})"
        ng-class="{
          'btn-offer-hosting-no': !trOfferHost.offer || trOfferHost.offer.status === 'no',
          'btn-offer-hosting-yes': trOfferHost.offer.status === 'yes',
          'btn-offer-hosting-maybe': trOfferHost.offer.status === 'maybe'
        }">
        { trOfferHost.hostingStatusLabel(trOfferHost.offer.status) }
      </a>
    );
  }

  renderHostingYesMaybe() {
    return(
      <div>
        {/*  Edit button  */}
        <a ui-sref="offer.host.edit"
            class="btn btn-inverse-primary btn-round btn-raised pull-right"
            aria-label="Modify hosting offer"
            ng-if="trOfferHost.isOwnOffer">
          <span class="icon-edit"></span>
        </a>

        {/*  Short descriptions  */}
        <div ng-if="trOfferHost.offer.description && trOfferHost.offer.description.length < 2000"
              ng-bind-html="trOfferHost.offer.description | trustedHtml"></div>

        {/*  Long descriptions  */}
        <div ng-if="trOfferHost.offer.description && trOfferHost.offer.description.length >= 2000">
          <div class="panel-more-wrap"
                ng-hide="trOfferHost.offerDescriptionToggle">
            <div ng-bind-html="trOfferHost.offer.description | limitTo:2000 | trustedHtml"
                  class="panel-more-excerpt"
                  ng-click="trOfferHost.offerDescriptionToggle=true"></div>
            <div class="panel-more-fade"
                  ng-click="trOfferHost.offerDescriptionToggle=true">
              Show more...
            </div>
          </div>
          <div ng-bind-html="trOfferHost.offer.description | trustedHtml"
                ng-show="trOfferHost.offerDescriptionToggle"></div>
        </div>

        <p class="offer-restrictions">
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
       <a ui-sref="offer.host.edit({'status': 'no'})"
           class="btn btn-inverse-primary btn-round btn-raised pull-right"
           aria-label="Modify hosting offer"
           ng-if="isOwnOffer">
         <span class="icon-edit"></span>
       </a>

      {/*  User has written explanation  */}
       <div ng-if="trOfferHost.offer.noOfferDescription" ng-bind-html="trOfferHost.offer.noOfferDescription | trustedHtml"></div>

      {/*  Default "sorry nope"  */}
       <div class="content-empty text-muted" ng-if="!trOfferHost.offer.noOfferDescription">
         <div class="icon-sofa icon-3x text-muted"></div>

        {/*  Show for others  */}
         <h4 ng-if="!trOfferHost.isOwnOffer">
           Sorry, user is not hosting currently.
         </h4>

        {/*  Show for the user  */}
         <div ng-if="trOfferHost.isOwnOffer">
           <br />
           <p class="lead">
             <em>Offering hospitality and welcoming “strangers” to our homes strengthens our faith in each other.</em>
           </p>
           <br />
         </div>
       </div>

      {/*  Action button  */}
       <div ng-if="trOfferHost.isOwnOffer && (!trOfferHost.offer.status || trOfferHost.offer.status === 'no')"
             class="text-center">
         <br />
         <hr class="hr-gray hr-tight hr-xs" />
         <a ui-sref="offer.host.edit({status: 'yes'})"
             class="btn btn-inverse-primary">
           Start hosting travellers
         </a>
         &nbsp;
         <a ui-sref="offer.meet.list"
             class="btn btn-inverse-primary">
           Meet people
         </a>
       </div>
     </div>
    );
  }

  renderMap() {
    return(
      <div> {/* / TODO change later to <> */}
        <offer-location
        ng-if="trOfferHost.offer.status === 'yes' || trOfferHost.offer.status === 'maybe'"
        offer="trOfferHost.offer"
        ></offer-location>

        <div class="panel-footer text-center"
              ng-if="trOfferHost.offer.status === 'yes' || trOfferHost.offer.status === 'maybe'">
          <a ui-sref="search.map({offer: trOfferHost.offer._id})"
              class="btn btn-sm btn-inverse-primary">
            Bigger map
          </a>
          <a ng-if="::trOfferHost.isMobile"
            ng-href="geo:{{trOfferHost.offer.location[0]}},{{trOfferHost.offer.location[1]}};u=200"
              class="btn btn-sm btn-inverse-primary">
            Open on device
          </a>
        </div>
      </div>
    );
  }

  renderOffer() {
    return(
      <div class="panel panel-default offer-view">
        <div class="panel-heading">
          Accommodation
         {/*  Button + dropdown for user's own profile  */}
         {isOwnOffer && this.renderButtonOwn()}
         {/*  Button for other profiles  */}
         {!isOwnOffer && this.renderButtonOther()}
        </div>

        {/*  Show offer  */}
        <div class="panel-body">
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