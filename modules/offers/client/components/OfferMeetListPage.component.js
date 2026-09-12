import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';

import LoadingIndicator from '@/modules/core/client/components/LoadingIndicator';
import { trackEvent } from '@/modules/core/client/services/client-runtime';
import { deleteOffer, getOffers } from '../api/offers.api';
import NoMeets from './NoMeets.component';
import OfferLocation from './OfferLocation.component';

export default function OfferMeetListPage({ user }) {
  const [offers, setOffers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRemoving, setIsRemoving] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState({});

  useEffect(() => {
    let isMounted = true;

    async function loadOffers() {
      setIsLoading(true);

      try {
        const data = await getOffers(user._id, 'meet');

        if (isMounted) {
          setOffers(
            (data || []).sort(
              (left, right) =>
                new Date(right.validUntil) - new Date(left.validUntil),
            ),
          );
        }
      } catch {
        if (isMounted) {
          setOffers([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadOffers();

    return () => {
      isMounted = false;
    };
  }, [user._id]);

  async function handleRemove(offer) {
    if (
      isRemoving ||
      !window.confirm('Are you sure you want to remove this?')
    ) {
      return;
    }

    setIsRemoving(true);

    try {
      await deleteOffer(offer._id);
      setOffers(current => current.filter(item => item._id !== offer._id));
      trackEvent('offer-delete', {
        category: 'offer.meet.delete',
        label: 'Removed meet offer',
      });
    } finally {
      setIsRemoving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="text-center text-muted">
        <LoadingIndicator />
      </div>
    );
  }

  return (
    <section className="offers-list">
      <div className="row">
        <div className="col-xs-12 col-sm-10">
          <h3>Your meetups</h3>
        </div>
        <div className="col-xs-12 col-sm-2 text-right">
          <a
            aria-label="Add new meet offer"
            className="btn btn-lg btn-primary"
            href="/offer/meet/add"
          >
            Add new
          </a>
        </div>
      </div>

      <hr className="hr-gray hr-tight" />

      {!offers.length && <NoMeets />}

      {offers.map(offer => (
        <div
          className="panel panel-default"
          id={`offer-${offer._id}`}
          key={offer._id}
        >
          <div className="panel-body">
            <OfferLocation location={offer.location} offerType={offer.type} />

            <br />
            <br />

            {!offer.description && (
              <div className="text-center text-muted">
                <em>No description!</em>
                <br />
                <br />
                <a
                  className="btn btn-primary"
                  href={`/offer/meet/${offer._id}`}
                >
                  Write description
                </a>
              </div>
            )}

            {offer.description && offer.description.length < 2000 && (
              <div dangerouslySetInnerHTML={{ __html: offer.description }} />
            )}

            {offer.description && offer.description.length >= 2000 && (
              <div>
                {!expandedDescriptions[offer._id] ? (
                  <div className="panel-more-wrap">
                    <div
                      className="panel-more-excerpt"
                      dangerouslySetInnerHTML={{
                        __html: offer.description.slice(0, 2000),
                      }}
                      onClick={() =>
                        setExpandedDescriptions(current => ({
                          ...current,
                          [offer._id]: true,
                        }))
                      }
                      role="presentation"
                    />
                    <div
                      className="panel-more-fade"
                      onClick={() =>
                        setExpandedDescriptions(current => ({
                          ...current,
                          [offer._id]: true,
                        }))
                      }
                      role="presentation"
                    >
                      Show more...
                    </div>
                  </div>
                ) : (
                  <div
                    dangerouslySetInnerHTML={{ __html: offer.description }}
                  />
                )}
              </div>
            )}

            <br />
            <br />

            <div className="text-center">
              <a
                className="btn btn-inverse-primary"
                href={`/search?offer=${offer._id}`}
              >
                <span className="hidden-xs">See on big map</span>
                <span className="visible-xs-inline">Big Map</span>
              </a>
              &nbsp;
              <a
                aria-label="Modify this meet offer"
                className="btn btn-inverse-primary"
                href={`/offer/meet/${offer._id}`}
              >
                Modify
              </a>
              &nbsp;
              <button
                aria-label="Remove this meet offer"
                className="btn btn-inverse-primary"
                disabled={isRemoving}
                onClick={() => handleRemove(offer)}
                type="button"
              >
                Remove
              </button>
            </div>
          </div>
          <div className="panel-footer text-muted text-center">
            Will be hidden{' '}
            {new Date(offer.validUntil).toLocaleDateString(undefined, {
              dateStyle: 'medium',
            })}
          </div>
        </div>
      ))}

      {offers.length > 0 && (
        <div className="text-center">
          <br />
          <a className="btn btn-lg btn-primary" href="/offer/meet/add">
            Add new meetup
          </a>
        </div>
      )}
    </section>
  );
}

OfferMeetListPage.propTypes = {
  user: PropTypes.object.isRequired,
};
