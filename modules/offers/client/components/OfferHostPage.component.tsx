import React, { useEffect, useState } from 'react';
import { Tab, Tabs } from 'react-bootstrap';

import {
  getCurrentRouteParams,
  trackEvent,
} from '@/modules/core/client/services/client-runtime';
import LoadingIndicator from '@/modules/core/client/components/LoadingIndicator';
import { createOffer, getOffers, updateOffer } from '../api/offers.api';
import type { CreateOfferRequest } from '../../shared/offer';
import { plainTextLength } from './offerEdit.helpers';
import OfferLocationEditor from './OfferLocationEditor.component';

type HostStatus = 'yes' | 'maybe' | 'no';
const HOST_STATUSES: HostStatus[] = ['yes', 'maybe', 'no'];
const HOST_TABS = ['availability', 'description', 'location'] as const;

function getTabFromHash() {
  const tab = window.location.hash.slice(1);
  return HOST_TABS.find(value => value === tab) || 'availability';
}

interface HostOffer {
  _id?: string;
  type: 'host';
  status: HostStatus;
  description: string;
  noOfferDescription: string;
  location: [number, number] | null;
  maxGuests: number;
  happyToMeet: boolean;
  showOnlyInMyCircles: boolean;
}

interface HostPageProps {
  user: { _id: string; username: string };
}

function defaultHostOffer(): HostOffer {
  return {
    type: 'host',
    status: 'yes',
    description: '',
    noOfferDescription: '',
    location: null,
    maxGuests: 1,
    happyToMeet: false,
    showOnlyInMyCircles: false,
  };
}

export default function OfferHostPage({ user }: HostPageProps) {
  const routeParams = getCurrentRouteParams();
  const [offer, setOffer] = useState<HostOffer>(defaultHostOffer());
  const [activeTab, setActiveTab] = useState<string>(getTabFromHash);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [firstTimeAround, setFirstTimeAround] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const syncTab = () => setActiveTab(getTabFromHash());
    window.addEventListener('hashchange', syncTab);
    window.addEventListener('popstate', syncTab);
    return () => {
      window.removeEventListener('hashchange', syncTab);
      window.removeEventListener('popstate', syncTab);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadOffer() {
      setIsLoading(true);
      setLoadError(false);

      try {
        const offers = await getOffers(user._id, 'host');
        const nextOffer: HostOffer = offers?.[0]
          ? { ...defaultHostOffer(), ...offers[0], type: 'host' }
          : defaultHostOffer();

        if (
          routeParams.status === 'yes' ||
          routeParams.status === 'maybe' ||
          routeParams.status === 'no'
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

  if (loadError) {
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
  const hasLocation =
    Array.isArray(offer.location) && offer.location.length === 2;

  function selectTab(tab: string) {
    setActiveTab(tab);
    window.location.hash = tab;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSaving || isDescriptionTooShort || !hasLocation) {
      return;
    }

    setIsSaving(true);

    try {
      const payload: CreateOfferRequest = {
        type: 'host',
        status: offer.status,
        description: offer.description,
        noOfferDescription: offer.noOfferDescription,
        maxGuests: offer.maxGuests,
        happyToMeet: offer.happyToMeet,
        showOnlyInMyCircles: offer.showOnlyInMyCircles,
        location: offer.location!,
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
    <section className="offers-edit offers-edit-host">
      <form autoComplete="off" noValidate onSubmit={handleSubmit}>
        <div className="offer-host-header">
          <h1>Hosting offer</h1>
          <button
            className="btn btn-lg btn-inverse-primary"
            disabled={isSaving || isDescriptionTooShort || !hasLocation}
            title={
              isDescriptionTooShort
                ? 'Write longer description first'
                : !hasLocation
                  ? 'Choose a location first'
                  : undefined
            }
            type="submit"
          >
            Save and Exit
          </button>
        </div>

        <Tabs
          activeKey={activeTab}
          className="offer-tabs"
          id="offer-host-tabs"
          onSelect={key => {
            if (key !== null) {
              selectTab(String(key));
            }
          }}
        >
          <Tab eventKey="availability" title="Availability">
            {!hasLocation && (
              <p className="alert alert-info" role="status">
                <a
                  href="#location"
                  onClick={event => {
                    event.preventDefault();
                    selectTab('location');
                  }}
                >
                  Choose a location
                </a>{' '}
                in the Location tab before saving, even if you cannot host.
              </p>
            )}
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
                        {HOST_STATUSES.map(status => (
                          <label
                            className={`btn btn-lg btn-offer-hosting btn-offer-hosting-${status}${
                              offer.status === status ? ' active' : ''
                            }`}
                            key={status}
                          >
                            <input
                              checked={offer.status === status}
                              name="offerStatus"
                              onChange={() =>
                                setOffer(current => ({ ...current, status }))
                              }
                              className="sr-only"
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

                    <div className="checkbox">
                      <label>
                        <input
                          checked={offer.happyToMeet}
                          onChange={({ target: { checked } }) =>
                            setOffer(current => ({
                              ...current,
                              happyToMeet: checked,
                            }))
                          }
                          type="checkbox"
                        />
                        Happy to meet
                      </label>
                    </div>
                    <p role="status">
                      {offer.status === 'no'
                        ? offer.happyToMeet
                          ? 'You will appear on the map for meetings, but not as a host.'
                          : 'You will not appear on the map for hosting or ongoing meetings.'
                        : offer.happyToMeet
                          ? 'You will appear on the map for hosting and meetings.'
                          : 'You will appear on the map for hosting.'}{' '}
                      Meetings use this same approximate location and circle
                      visibility setting.
                    </p>
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
                          People that are not in any of my circles should not
                          find me.
                        </label>
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
                              size={2}
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
          <Tab eventKey="description" title="Description">
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
          <Tab eventKey="location" title="Location">
            <div id="location">
              {!hasLocation && (
                <p className="alert alert-info" role="status">
                  Search for a place or move the map to set your hosting
                  location.
                </p>
              )}
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
            </div>
          </Tab>
        </Tabs>
      </form>
    </section>
  );
}
