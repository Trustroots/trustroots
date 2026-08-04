import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';
import { Tab, Tabs } from 'react-bootstrap';

import {
  getCurrentRouteParams,
  trackEvent,
} from '@/modules/core/client/services/client-runtime';
import { DEFAULT_LOCATION } from '@/modules/core/client/utils/constants';
import LoadingIndicator from '@/modules/core/client/components/LoadingIndicator';
import { createOffer, getOffers, updateOffer } from '../api/offers.api';
import OfferLocationEditor from './OfferLocationEditor.component';

/* istanbul ignore next -- offer descriptions are initialised before validation. */
function plainTextLength(value = '') {
  return value.replace(/<[^>]*>/g, '').trim().length;
}

function defaultHostOffer() {
  return {
    type: 'host',
    status: 'yes',
    description: '',
    noOfferDescription: '',
    location: [DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng],
    maxGuests: 1,
    showOnlyInMyCircles: false,
  };
}

export default function OfferHostPage({ user }) {
  const routeParams = getCurrentRouteParams();
  const [offer, setOffer] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [firstTimeAround, setFirstTimeAround] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadOffer() {
      setIsLoading(true);
      setLoadError(false);

      try {
        const offers = await getOffers(user._id, 'host');
        const nextOffer = offers?.[0]
          ? { ...defaultHostOffer(), ...offers[0] }
          : defaultHostOffer();

        if (
          routeParams.status &&
          ['yes', 'maybe', 'no'].includes(routeParams.status)
        ) {
          nextOffer.status = routeParams.status;
        }

        if (isMounted) {
          setOffer(nextOffer);
          setFirstTimeAround(!offers?.length);
        }
      } catch {
        if (isMounted) {
          setLoadError(true);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadOffer();

    return () => {
      isMounted = false;
    };
  }, [routeParams.status, user._id]);

  if (isLoading) {
    return (
      <div className="text-center text-muted">
        <LoadingIndicator />
      </div>
    );
  }

  if (loadError || !offer) {
    return (
      <div className="text-center lead" role="alert">
        <br />
        <br />
        Snap!
        <br />
        Something went wrong.
        <br />
        <br />
        If this keeps happening, please contact us.
        <br />
        <br />
        <a href="/support">Support</a>
      </div>
    );
  }

  const isDescriptionTooShort =
    offer.status !== 'no' && plainTextLength(offer.description) < 5;

  async function handleSubmit(event) {
    event.preventDefault();

    if (isSaving || isDescriptionTooShort) {
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        type: 'host',
        status: offer.status,
        description: offer.description,
        noOfferDescription: offer.noOfferDescription,
        maxGuests: offer.maxGuests,
        showOnlyInMyCircles: offer.showOnlyInMyCircles,
        location: offer.location,
      };

      if (offer._id) {
        await updateOffer(offer._id, payload);
      } else {
        await createOffer(payload);
      }

      trackEvent('offer-modified', {
        category: 'offer.edit',
        label: 'Modified offer',
        value: offer.status,
      });

      window.location.assign(`/profile/${user.username}`);
    } catch {
      setIsSaving(false);
    }
  }

  return (
    <section className="offers-edit">
      <form autoComplete="off" noValidate onSubmit={handleSubmit}>
        <button
          aria-hidden="true"
          className="btn btn-lg btn-inverse-primary pull-right hidden-xs"
          disabled={isSaving || isDescriptionTooShort}
          title={
            isDescriptionTooShort ? 'Write longer description first' : undefined
          }
          type="submit"
        >
          Save and Exit
        </button>

        <Tabs
          activeKey={activeTab}
          className="offer-tabs"
          id="offer-host-tabs"
          onSelect={setActiveTab}
        >
          <Tab eventKey={0} title="Availability">
            <div className="row">
              <div className="col-xs-12 col-sm-6">
                <div className="panel panel-default offer-meta">
                  <div className="panel-body">
                    <fieldset>
                      <legend>
                        <h4 id="offerStatus">Can you host?</h4>
                      </legend>
                      <div
                        aria-labelledby="offerStatus"
                        className="btn-group"
                        role="radiogroup"
                      >
                        {['yes', 'maybe', 'no'].map(status => (
                          <label
                            aria-checked={offer.status === status}
                            className={`btn btn-lg btn-offer-hosting btn-offer-hosting-${status}${
                              offer.status === status ? ' active' : ''
                            }`}
                            key={status}
                            role="radio"
                          >
                            <input
                              checked={offer.status === status}
                              name="offerStatus"
                              onChange={() =>
                                setOffer(current => ({ ...current, status }))
                              }
                              style={{ display: 'none' }}
                              type="radio"
                              value={status}
                            />
                            <span>
                              {status.charAt(0).toUpperCase() + status.slice(1)}
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    {offer.status !== 'no' && (
                      <>
                        <br />
                        <br />
                        <fieldset className="offer-maxguests">
                          <legend>
                            <h4 id="maxGuests">
                              How many guests can you accommodate?
                            </h4>
                          </legend>
                          <div className="input-group input-group-stepper">
                            <span className="input-group-btn">
                              <button
                                aria-hidden="true"
                                className="btn btn-lg btn-inverse-primary btn-round"
                                disabled={offer.maxGuests <= 1}
                                onClick={() =>
                                  setOffer(current => ({
                                    ...current,
                                    maxGuests: current.maxGuests - 1,
                                  }))
                                }
                                type="button"
                              >
                                <i className="icon-minus"></i>
                              </button>
                            </span>
                            <input
                              aria-labelledby="maxGuests"
                              aria-required="true"
                              className="form-control input-lg input-plain text-center font-brand-regular"
                              max="99"
                              min="1"
                              onChange={({ target: { value } }) =>
                                setOffer(current => ({
                                  ...current,
                                  maxGuests: Number(value) || 1,
                                }))
                              }
                              size="2"
                              step="1"
                              type="number"
                              value={offer.maxGuests}
                            />
                            <span className="input-group-btn">
                              <button
                                aria-hidden="true"
                                className="btn btn-lg btn-inverse-primary btn-round"
                                disabled={offer.maxGuests >= 99}
                                onClick={() =>
                                  setOffer(current => ({
                                    ...current,
                                    maxGuests: current.maxGuests + 1,
                                  }))
                                }
                                type="button"
                              >
                                <i className="icon-plus"></i>
                              </button>
                            </span>
                          </div>
                        </fieldset>

                        <br />
                        <br />

                        <fieldset>
                          <legend>
                            <h4>Available only in my circles?</h4>
                          </legend>
                          <div className="checkbox">
                            <label>
                              <input
                                checked={offer.showOnlyInMyCircles}
                                onChange={({ target: { checked } }) =>
                                  setOffer(current => ({
                                    ...current,
                                    showOnlyInMyCircles: checked,
                                  }))
                                }
                                type="checkbox"
                              />
                              People that are not in any of my circles should
                              not find me.
                            </label>
                          </div>
                        </fieldset>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="col-xs-12 col-sm-6 text-center hidden-xs">
                <div
                  aria-hidden="true"
                  className="icon-sofa icon-3x text-muted"
                ></div>
                <h3>Host Trustroots members</h3>
                <p className="lead">
                  <em>
                    Offering hospitality and welcoming “strangers” to our homes
                    strengthens our faith in each other.
                  </em>
                </p>
              </div>
            </div>
          </Tab>
          <Tab eventKey={1} title="Description">
            {offer.status === 'no' && (
              <div className="panel panel-default">
                <div className="panel-heading">
                  <h4 id="noOfferDescriptionLabel">
                    Tell others why you cannot host...
                  </h4>
                </div>
                <div className="panel-body">
                  <textarea
                    aria-labelledby="noOfferDescriptionLabel"
                    className="form-control"
                    onChange={({ target: { value } }) =>
                      setOffer(current => ({
                        ...current,
                        noOfferDescription: value,
                      }))
                    }
                    placeholder="Write here..."
                    rows={6}
                    value={offer.noOfferDescription || ''}
                  />
                </div>
              </div>
            )}
            <div className="panel panel-default">
              <div className="panel-heading">
                <h4 id="offerDescriptionLabel">
                  Tell about your home and hosting possibilities
                  {offer.status !== 'no' && <i> (required)</i>}
                </h4>
              </div>
              <div className="panel-body">
                <textarea
                  aria-labelledby="offerDescriptionLabel"
                  aria-required={offer.status !== 'no'}
                  className="form-control offer-description"
                  onChange={({ target: { value } }) =>
                    setOffer(current => ({ ...current, description: value }))
                  }
                  placeholder="Write here..."
                  rows={8}
                  value={offer.description || ''}
                />
              </div>
            </div>
          </Tab>
          <Tab
            disabled={offer.status === 'no' || isDescriptionTooShort}
            eventKey={2}
            title="Location"
          >
            {firstTimeAround && (
              <div
                aria-describedby="firstTimeAroundDescription"
                aria-labelledby="firstTimeAroundLabel"
                className="alert alert-info offer-map-guide"
                role="dialog"
              >
                <p className="lead" role="document">
                  <strong id="firstTimeAroundLabel">
                    Set your hosting location on the map.
                  </strong>
                  <br />
                  <br />
                  <span id="firstTimeAroundDescription">
                    Your exact location will not be revealed to others; the
                    location is publicly randomised by a couple of hundred
                    metres.
                  </span>
                  <br />
                  <br />
                  <button
                    aria-label="Close information dialog about hosting location map"
                    className="btn btn-lg btn-info"
                    onClick={() => setFirstTimeAround(false)}
                    type="button"
                  >
                    Got it!
                  </button>
                </p>
              </div>
            )}
            <OfferLocationEditor
              location={offer.location}
              offerStatus={offer.status}
              offerType="host"
              onLocationChange={location =>
                setOffer(current => ({ ...current, location }))
              }
            />
          </Tab>
        </Tabs>
      </form>
    </section>
  );
}

OfferHostPage.propTypes = {
  user: PropTypes.object.isRequired,
};
