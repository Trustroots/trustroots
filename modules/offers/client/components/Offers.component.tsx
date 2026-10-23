// External dependencies
import React, { Component } from 'react';

// Internal dependencies
import { getOffers, updateOffer, type Offer } from '../api/offers.api';
import type { MeetingStatus } from '../../shared/offer';
import OffersPresentational from './OffersPresentational';

interface ProfileSummary {
  _id?: string;
  username?: string;
  public?: boolean;
}

interface OffersProps {
  authUser?: ProfileSummary | null;
  profile?: ProfileSummary | null;
}

interface OffersState {
  offer: Offer;
  isLoading: boolean;
  isOwnOffer: boolean;
  isUserPublic: boolean;
  isMobile: boolean;
  isSavingMeeting: boolean;
  meetingError: boolean;
}

export class Offers extends Component<OffersProps, OffersState> {
  constructor(props: OffersProps) {
    super(props);
    this.state = {
      offer: {},
      isSavingMeeting: false,
      meetingError: false,
      isLoading: true,
      isOwnOffer: false,
      isUserPublic: false,
      isMobile:
        window.navigator.userAgent.toLowerCase().indexOf('mobile') >= 0 ||
        ((window as Window & { isNativeMobileApp?: boolean })
          .isNativeMobileApp ??
          false),
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
        isOwnOffer: authUser?._id === profile._id,
        isUserPublic: Boolean(authUser?.public),
      }));

      const offers = await getOffers(profile._id, 'host');
      this.setState(() => ({
        isLoading: false,
        offer: offers?.[0] ?? { status: 'no' },
      }));
    }
  }

  saveMeetingStatus = async (meetingStatus: MeetingStatus) => {
    const { offer, isOwnOffer, isSavingMeeting } = this.state;
    if (!isOwnOffer || isSavingMeeting || !offer._id || !offer.location) return;
    this.setState({ isSavingMeeting: true, meetingError: false });
    try {
      await updateOffer(offer._id, { meetingStatus, location: offer.location });
      this.setState({ offer: { ...offer, meetingStatus } });
    } catch {
      this.setState({ meetingError: true });
    } finally {
      this.setState({ isSavingMeeting: false });
    }
  };

  render() {
    const { isOwnOffer, isUserPublic, offer } = this.state;

    // An empty offer is only meaningful after the profile's offers have
    // loaded. In particular, don't briefly present the default "no" status
    // while switching back to this tab remounts the component and refetches.
    if (this.state.isLoading || !this.props.profile?._id) {
      return null;
    }

    return (
      <OffersPresentational
        isOwnOffer={isOwnOffer}
        isUserPublic={isUserPublic}
        offer={offer}
        onMeetingStatusChange={
          isOwnOffer && offer._id && offer.location
            ? this.saveMeetingStatus
            : undefined
        }
        isSavingMeeting={this.state.isSavingMeeting}
        meetingError={this.state.meetingError}
        username={this.props.profile?.username}
      />
    );
  }
}

export default Offers;
