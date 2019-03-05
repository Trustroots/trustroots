import React, { Component } from 'react';
import OffersPresentational from './OffersPresentational';
import * as offersAPI from '../api/offers.api';


import PropTypes from 'prop-types';

export class Offers extends Component {
  constructor(props) {
    super(props);
    this.state = {
      offer: {},
      isLoading: true,
      isOwnOffer: false,
      isUserPublic: false,
      isMobile: window.navigator.userAgent.toLowerCase().indexOf('mobile') >= 0 || window.isNativeMobileApp
    };
  }

  async componentDidMount() {
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

      const offers = await offersAPI.getOffers(profile._id);
      if (!offers || !offers.length) {
        this.setState(() => ({
          isLoading: false
        })
        );
      } else {
        that.setState(() => ({
          offer: offers[0],
          isLoading: false
        }));
      }
    }
  }

  render(){
    return <OffersPresentational
      isOwnOffer={this.state.isOwnOffer}
      isUserPublic={this.state.isUserPublic}
      offer={this.state.offer}
      username={this.props.profile.username}>
    </OffersPresentational>;
  }
};

Offers.propTypes = {
  authUser: PropTypes.object.isRequired,
  profile: PropTypes.object.isRequired
};

export default Offers;
