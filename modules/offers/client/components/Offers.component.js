// External dependencies
import PropTypes from 'prop-types';
import React, { Component } from 'react';

// Internal dependencies
import { getOffers } from '../api/offers.api';
import OffersPresentational from './OffersPresentational';

export class Offers extends Component {
  constructor(props) {
    super(props);
    this.state = {
      offer: {},
      isLoading: true,
      isOwnOffer: false,
      isUserPublic: false,
      isMobile:
        window.navigator.userAgent.toLowerCase().indexOf('mobile') >= 0 ||
        window.isNativeMobileApp,
    };
  }

  async componentDidMount() {
    const { profile, authUser } = this.props;
    if (!profile) {
      this.setState(() => ({ isLoading: false }));
      return;
    }
    if (profile._id) {
      this.setState(() => ({
        profile,
        isOwnOffer: authUser && authUser._id && authUser._id === profile._id,
        isUserPublic: authUser && authUser.public,
      }));

      const offers = await getOffers(profile._id, 'host');
      this.setState(() => ({
        isLoading: false,
        offer: offers?.[0] ?? { status: 'no' },
      }));
    }
  }

  render() {
    const { isOwnOffer, isUserPublic, offer } = this.state;

    return (
      <OffersPresentational
        isOwnOffer={isOwnOffer}
        isUserPublic={isUserPublic}
        offer={offer}
        username={this.props.profile.username}
      />
    );
  }
}

Offers.propTypes = {
  authUser: PropTypes.object.isRequired,
  profile: PropTypes.object.isRequired,
};

export default Offers;
