import { useBlocker, useLocation, useSearch } from '@tanstack/react-router';
import isEqual from 'lodash/isEqual';
import React, { useEffect, useRef, useState } from 'react';
import { Alert } from '@trustroots/ui/Alert';
import { Button } from '@trustroots/ui/Button';
import { ButtonGroup } from '@trustroots/ui/ButtonGroup';

import { saveFailureReason, useAnalytics } from '@trustroots/analytics/client';
import LoadingIndicator from '@/modules/core/client/components/LoadingIndicator';
import { createOffer, getOffers, updateOffer } from '../api/offers.api';
import type { CreateOfferRequest } from '../../shared/offer';
import { plainTextLength } from './offerEdit.helpers';
import MeetingAvailabilityControl from './MeetingAvailabilityControl';
import OfferLocationEditor from './OfferLocationEditor.component';
import { hostStatusIntent } from './hostStatusIntent';

type HostStatus = 'yes' | 'maybe' | 'no';
const HOST_STATUSES: HostStatus[] = ['yes', 'maybe', 'no'];
const HOST_SECTIONS = new Set(['availability', 'description', 'location']);

interface HostOffer {
  _id?: string;
  type: 'host';
  status: HostStatus;
  description: string;
  noOfferDescription: string;
  location: [number, number] | null;
  maxGuests: number;
  meetingStatus: 'yes' | 'maybe' | 'no' | 'not-set';
  showOnlyInMyCircles: boolean;
  requireHostingDescriptionAcknowledgement: boolean;
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
    meetingStatus: 'not-set',
    showOnlyInMyCircles: false,
    requireHostingDescriptionAcknowledgement: false,
  };
}

export default function OfferHostPage({ user }: HostPageProps) {
  const { track } = useAnalytics();
  const routeParams = useSearch({ strict: false });
  const { hash, pathname, searchStr } = useLocation();
  const [offer, setOffer] = useState<HostOffer>(defaultHostOffer());
  const savedOffer = useRef(offer);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [firstTimeAround, setFirstTimeAround] = useState(false);
  const [loadError, setLoadError] = useState(false);

  function hasUnsavedChanges() {
    return !isEqual(offer, savedOffer.current);
  }

  useBlocker({
    shouldBlockFn: ({ current, next }) =>
      hasUnsavedChanges() &&
      (current.pathname !== next.pathname ||
        !isEqual(current.search, next.search)) &&
      !window.confirm('Leave without saving your hosting offer changes?'),
    enableBeforeUnload: hasUnsavedChanges,
  });

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
          savedOffer.current = nextOffer;
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

  useEffect(() => {
    if (!isLoading && !loadError && HOST_SECTIONS.has(hash)) {
      document.getElementById(hash)!.scrollIntoView({ block: 'start' });
    }
  }, [hash, isLoading, loadError]);

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
  const saveDisabled = isSaving || isDescriptionTooShort || !hasLocation;
  const saveTitle = isDescriptionTooShort
    ? 'Write longer description first'
    : !hasLocation
      ? 'Choose a location first'
      : undefined;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saveDisabled) {
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
        meetingStatus: offer.meetingStatus,
        showOnlyInMyCircles: offer.showOnlyInMyCircles,
        requireHostingDescriptionAcknowledgement:
          offer.requireHostingDescriptionAcknowledgement,
        location: offer.location!,
      };

      if (offer._id) {
        await updateOffer(offer._id, payload);
      } else {
        await createOffer(payload);
      }

      track('offer_saved', {
        type: 'host',
        action: offer._id ? 'update' : 'create',
        status: offer.status,
      });

      savedOffer.current = offer;
      window.location.assign(`/profile/${user.username}`);
    } catch (error: unknown) {
      track('offer_save_failed', {
        type: 'host',
        reason: saveFailureReason(error),
      });
      setIsSaving(false);
    }
  }

  return (
    <section className="offers-edit offers-edit-host">
      <form autoComplete="off" noValidate onSubmit={handleSubmit}>
        <div className="offer-host-header">
          <h1>Hosting offer</h1>
          <Button
            variant="outline"
            intent="primary"
            size="lg"
            disabled={saveDisabled}
            title={saveTitle}
            type="submit"
          >
            Save and Exit
          </Button>
        </div>

        <div className="offer-host-sections">
          <section id="availability" aria-label="Availability">
            {!hasLocation && (
              <Alert intent="info" role="status">
                <a href={`${pathname}${searchStr}#location`}>
                  Choose a location
                </a>{' '}
                before saving, even if you cannot host.
              </Alert>
            )}
            <div className="panel panel-default offer-meta">
              <div className="panel-body">
                <fieldset>
                  <legend>
                    <h4 id="offerStatus">Can you host?</h4>
                  </legend>
                  <ButtonGroup aria-labelledby="offerStatus" role="radiogroup">
                    {HOST_STATUSES.map(status => (
                      <Button
                        intent={hostStatusIntent[status]}
                        size="lg"
                        // The label gets the radio and its text below as
                        // children through the render prop.
                        // eslint-disable-next-line jsx-a11y/label-has-associated-control
                        render={<label />}
                        className={`offer-hosting-button${
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
                          className="offer-availability-radio"
                          type="radio"
                          value={status}
                        />
                        <span>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                      </Button>
                    ))}
                  </ButtonGroup>
                </fieldset>

                <MeetingAvailabilityControl
                  value={offer.meetingStatus}
                  onChange={meetingStatus =>
                    setOffer(current => ({ ...current, meetingStatus }))
                  }
                  disabled={isSaving}
                />
                <p role="status">
                  {offer.status === 'no'
                    ? ['yes', 'maybe'].includes(offer.meetingStatus)
                      ? 'You will appear on the map for meetings, but not as a host.'
                      : 'You will not appear on the map for hosting or ongoing meetings.'
                    : ['yes', 'maybe'].includes(offer.meetingStatus)
                      ? 'You will appear on the map for hosting and meetings.'
                      : 'You will appear on the map for hosting.'}{' '}
                  Meetings use this same approximate location and circle
                  visibility setting.
                </p>
              </div>
            </div>
          </section>
          <section id="description" aria-label="Description">
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
                <div className="checkbox offer-host-checkbox offer-host-acknowledgement">
                  <label>
                    <input
                      aria-describedby="hostingAcknowledgementHelp"
                      checked={offer.requireHostingDescriptionAcknowledgement}
                      onChange={({ target: { checked } }) =>
                        setOffer(current => ({
                          ...current,
                          requireHostingDescriptionAcknowledgement: checked,
                        }))
                      }
                      type="checkbox"
                    />
                    <span>
                      Require guests to acknowledge my hosting description before
                      sending their first hosting message in a conversation.
                    </span>
                  </label>
                  <p className="help-block" id="hostingAcknowledgementHelp">
                    Ordinary messages do not require acknowledgement. An
                    acknowledgement does not prove someone has read or understood
                    your requirements.
                  </p>
                </div>
                <fieldset className="offer-circle-settings">
                  <legend>
                    <h4>Available only in my circles?</h4>
                  </legend>
                  <div className="checkbox offer-host-checkbox">
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
                      <span>
                        People that are not in any of my circles should not find
                        me.
                      </span>
                    </label>
                  </div>
                </fieldset>

                {offer.status !== 'no' && (
                  <fieldset className="offer-maxguests">
                    <legend>
                      <h4 id="maxGuests">
                        How many guests can you accommodate?
                      </h4>
                    </legend>
                    <div className="input-group input-group-stepper">
                      <span className="input-group-btn">
                        <Button
                          aria-hidden="true"
                          variant="outline"
                          intent="primary"
                          size="lg"
                          round
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
                        </Button>
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
                        <Button
                          aria-hidden="true"
                          variant="outline"
                          intent="primary"
                          size="lg"
                          round
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
                        </Button>
                      </span>
                    </div>
                  </fieldset>
                )}
              </div>
            </div>
          </section>
          <section id="location" aria-label="Location">
            <div className="offer-host-map">
              {!hasLocation && (
                <Alert intent="info" role="status">
                  Search for a place or move the map to set your hosting
                  location.
                </Alert>
              )}
              {firstTimeAround && (
                <Alert
                  aria-describedby="firstTimeAroundDescription"
                  aria-labelledby="firstTimeAroundLabel"
                  intent="info"
                  className="offer-map-guide"
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
                    <Button
                      aria-label="Close information dialog about hosting location map"
                      intent="info"
                      size="lg"
                      onClick={() => setFirstTimeAround(false)}
                      type="button"
                    >
                      Got it!
                    </Button>
                  </p>
                </Alert>
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
          </section>
        </div>
        <div className="offer-host-save">
          <Button
            intent="primary"
            size="xl"
            disabled={saveDisabled}
            title={saveTitle}
            type="submit"
          >
            Save and Exit
          </Button>
        </div>
      </form>
    </section>
  );
}
