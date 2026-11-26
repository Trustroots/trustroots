import { Textarea } from '@trustroots/ui/Textarea';
import { Input } from '@trustroots/ui/Input';
import {
  deepEqual,
  useBlocker,
  useLocation,
  useSearch,
} from '@tanstack/react-router';
import React, { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Alert } from '@trustroots/ui/Alert';
import { Button } from '@trustroots/ui/Button';
import { ButtonGroup } from '@trustroots/ui/ButtonGroup';

import { saveFailureReason, useAnalytics } from '@trustroots/analytics/client';
import ProfileCompletionReminders from '@/modules/users/client/components/ProfileCompletionReminders.component';
import LoadingIndicator from '@/modules/core/client/components/LoadingIndicator';
import OfferLocationEditor from './OfferLocationEditor.component';
import { createOffer, getOffers, updateOffer } from '../api/offers.api';
import type { CreateOfferRequest } from '../../shared/offer';
import { hasHostingLocation, plainTextLength } from './offerEdit.helpers';
import MeetingAvailabilityControl from './MeetingAvailabilityControl';
import { hostStatusIntent } from './hostStatusIntent';

type HostStatus = 'yes' | 'maybe' | 'no';
const HOST_STATUSES: HostStatus[] = ['yes', 'maybe', 'no'];
const AUTOSAVE_DELAY = 600;
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
  volunteering: boolean;
  requireHostingDescriptionAcknowledgement: boolean;
}

interface HostPageProps {
  user: React.ComponentProps<typeof ProfileCompletionReminders>['profile'] & {
    _id: string;
    username: string;
  };
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
    volunteering: false,
    requireHostingDescriptionAcknowledgement: false,
  };
}

export default function OfferHostPage({ user }: HostPageProps) {
  const { track } = useAnalytics();
  const routeParams = useSearch({ strict: false });
  const fromMeet = routeParams.from === 'meet';
  const { hash, pathname, searchStr } = useLocation();
  const [offer, setOffer] = useState<HostOffer>(defaultHostOffer());
  const [saved, setSaved] = useState(offer);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const [saveError, setSaveError] = useState(false);
  const createAttempted = useRef(false);

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

        if (!hasHostingLocation(nextOffer.location)) nextOffer.location = null;

        if (!offers?.length) {
          if (fromMeet) nextOffer.status = 'no';
          else if (
            routeParams.status === 'yes' ||
            routeParams.status === 'maybe' ||
            routeParams.status === 'no'
          ) {
            nextOffer.status = routeParams.status;
          }
        }

        if (isMounted) {
          setSaved(nextOffer);
          setOffer(nextOffer);
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
  }, [fromMeet, routeParams.status, user._id]);

  useEffect(() => {
    if (!isLoading && !loadError && HOST_SECTIONS.has(hash)) {
      document.getElementById(hash)!.scrollIntoView({ block: 'start' });
    }
  }, [hash, isLoading, loadError]);

  const isDescriptionTooShort =
    offer.status !== 'no' && plainTextLength(offer.description) < 5;
  const location = hasHostingLocation(offer.location) ? offer.location : null;
  const hasLocation = location !== null;
  const hasValidGuestCount =
    Number.isInteger(offer.maxGuests) &&
    offer.maxGuests >= 0 &&
    offer.maxGuests <= 99;
  const isDirty = !deepEqual(
    { ...offer, _id: undefined },
    { ...saved, _id: undefined },
  );
  const shouldWarn = isDirty || isSaving || saveError;

  useBlocker({
    enableBeforeUnload: () => shouldWarn,
    shouldBlockFn: ({ current, next }) =>
      shouldWarn &&
      (current.pathname !== next.pathname ||
        !deepEqual(current.search, next.search)) &&
      !window.confirm('Leave without saving your hosting offer changes?'),
  });

  const saveOffer = useEffectEvent(
    async (draft: HostOffer, coordinates: [number, number]) => {
      const payload: CreateOfferRequest = {
        type: 'host',
        status: draft.status,
        description: draft.description,
        noOfferDescription: draft.noOfferDescription,
        maxGuests: draft.maxGuests,
        meetingStatus: draft.meetingStatus,
        volunteering: draft.volunteering,
        requireHostingDescriptionAcknowledgement:
          draft.requireHostingDescriptionAcknowledgement,
        showOnlyInMyCircles: draft.showOnlyInMyCircles,
        location: coordinates,
      };
      let id = saved._id;
      setIsSaving(true);

      try {
        // The previous request may have reached the server before it failed.
        if (!id && createAttempted.current) {
          id = (await getOffers(user._id, 'host'))[0]?._id;
        }

        const action = id ? 'update' : 'create';
        if (id) {
          await updateOffer(id, payload);
        } else {
          createAttempted.current = true;
          const created = await createOffer(payload);
          id = created._id ?? (await getOffers(user._id, 'host'))[0]?._id;
          if (!id) throw new Error('Could not find the saved hosting offer.');
        }

        setSaved({ ...draft, _id: id });
        track('offer_saved', { type: 'host', action, status: draft.status });
      } catch (error: unknown) {
        setSaveError(true);
        track('offer_save_failed', {
          type: 'host',
          reason: saveFailureReason(error),
        });
      } finally {
        setIsSaving(false);
      }
    },
  );

  const canSave = !isDescriptionTooShort && hasValidGuestCount && hasLocation;
  const [retry, setRetry] = useState(false);

  useEffect(() => {
    if (
      isLoading ||
      loadError ||
      (!isDirty && !retry) ||
      !canSave ||
      isSaving ||
      saveError ||
      !location
    )
      return;

    const timer = window.setTimeout(
      () => {
        setRetry(false);
        void saveOffer(offer, location);
      },
      retry ? 0 : AUTOSAVE_DELAY,
    );
    return () => window.clearTimeout(timer);
  }, [
    canSave,
    isDirty,
    isLoading,
    isSaving,
    loadError,
    location,
    offer,
    retry,
    saveError,
  ]);

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

  return (
    <section className="offers-edit offers-edit-host">
      <form
        autoComplete="off"
        noValidate
        onSubmit={event => event.preventDefault()}
      >
        <div className="offer-host-header">
          <h1>Hosting offer</h1>
          <div role="status">
            {isSaving && 'Saving…'}
            {!isSaving &&
              !saveError &&
              isDirty &&
              canSave &&
              'Changes pending…'}
            {!isSaving &&
              !saveError &&
              !isDirty &&
              saved._id &&
              'All changes saved'}
          </div>
        </div>

        <ProfileCompletionReminders profile={user} />
        {!saved._id && !fromMeet && (
          <p>
            Your hosting offer will go live automatically once the required
            details are complete.
          </p>
        )}
        {saveError && (
          <Alert intent="danger" role="alert">
            Could not save your hosting changes.{' '}
            <Button
              size="sm"
              disabled={!canSave}
              type="button"
              onClick={() => {
                setRetry(true);
                setSaveError(false);
              }}
            >
              Retry
            </Button>
          </Alert>
        )}

        {isDescriptionTooShort && (
          <p>
            <a href={`${pathname}${searchStr}#description`}>
              Add a hosting description
            </a>{' '}
            of at least five characters.
          </p>
        )}
        {!hasValidGuestCount && (
          <p>Enter a whole number of guests from 0 to 99.</p>
        )}
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
                        className="offer-hosting-button"
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
                  <Textarea
                    aria-labelledby="noOfferDescriptionLabel"
                    fieldSize="md"
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
                <label className="tw:mb-3 tw:block">
                  <input
                    checked={offer.volunteering}
                    onChange={({ target: { checked } }) =>
                      setOffer(current => ({
                        ...current,
                        volunteering: checked,
                      }))
                    }
                    type="checkbox"
                  />{' '}
                  Volunteering: can your guests help you with something?
                </label>
                <p id="volunteering-description-help">
                  If you welcome volunteering help, explain in your description
                  what help you need, whether it is optional or expected, and
                  what you offer your guests.
                </p>
                <Textarea
                  aria-labelledby="offerDescriptionLabel"
                  aria-describedby="volunteering-description-help"
                  aria-required={offer.status !== 'no'}
                  fieldSize="md"
                  className="offer-description"
                  onChange={({ target: { value } }) =>
                    setOffer(current => ({ ...current, description: value }))
                  }
                  placeholder="Write here..."
                  rows={8}
                  value={offer.description || ''}
                />
                <div className="tw:mt-3">
                  <label className="tw:flex tw:items-start tw:gap-2 tw:py-1.5 tw:text-start tw:max-sm:min-h-11 tw:max-sm:px-1.5">
                    <input
                      className="tw:mt-[0.15em] tw:size-4 tw:flex-none tw:accent-brand-primary"
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
                      Require guests to acknowledge my hosting description
                      before sending their first hosting message in a
                      conversation.
                    </span>
                  </label>
                  <p className="help-block" id="hostingAcknowledgementHelp">
                    Ordinary messages do not require acknowledgement. An
                    acknowledgement does not prove someone has read or
                    understood your requirements.
                  </p>
                </div>
                <fieldset className="offer-circle-settings">
                  <legend>
                    <h4>Available only in my circles?</h4>
                  </legend>
                  <div className="checkbox offer-circle-visibility">
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
                    <div
                      data-slot="input-group"
                      className="tw:input-group input-group-stepper"
                    >
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
                      <Input
                        aria-labelledby="maxGuests"
                        aria-required="true"
                        fieldSize="lg"
                        className="input-plain text-center font-brand-regular"
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
            {fromMeet && (
              <Alert intent="info" role="note">
                {saved._id && hasHostingLocation(saved.location) ? (
                  <a href="/offer/meet">Continue to meetups</a>
                ) : (
                  'Choose a location on the map to continue to meetups. Your location will save automatically.'
                )}
              </Alert>
            )}
            <p>
              Moving the pin saves the new location automatically when the offer
              is ready to save.
            </p>
            <OfferLocationEditor
              location={offer.location}
              offerStatus={offer.status}
              offerType="host"
              showHostingGuide={!saved._id && !fromMeet}
              onLocationChange={location =>
                setOffer(current => ({ ...current, location }))
              }
            />
            {!hasLocation && (
              <Alert intent="info" role="status">
                Search for a place or move the map to set your hosting location.
              </Alert>
            )}
          </section>
        </div>
      </form>
    </section>
  );
}
