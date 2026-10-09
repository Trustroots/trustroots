import PropTypes from 'prop-types';
import React, { useEffect, useMemo, useState } from 'react';
import * as ReactBootstrap from 'react-bootstrap';

import {
  getCurrentRouteParams,
  trackEvent,
} from '@/modules/core/client/services/client-runtime';
import LoadingIndicator from '@/modules/core/client/components/LoadingIndicator';
import { DEFAULT_LOCATION } from '@/modules/core/client/utils/constants';
import {
  createOffer,
  getOffer,
  updateOffer,
  type Offer,
} from '../api/offers.api';
import MeetsExplanation from './MeetsExplanation.component';
import OfferLocationEditor from './OfferLocationEditor.component';

const MIN_DESCRIPTION = 5;

interface MeetOffer {
  _id?: string;
  type: 'meet';
  description: string;
  location: [number, number] | null;
  validUntil: string | number | Date;
}

interface TabProps {
  children: React.ReactNode;
  eventKey: string | number;
  title: React.ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  children: React.ReactNode;
  activeKey: string | number;
  className: string;
  id: string;
  onSelect: (key: string | number | null) => void;
}

const { Tab, Tabs } = ReactBootstrap as unknown as {
  Tab: React.ComponentType<TabProps>;
  Tabs: React.ComponentType<TabsProps>;
};

function plainTextLength(value = ''): number {
  return value.replace(/<[^>]*>/g, '').trim().length;
}

function defaultValidUntil() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString();
}

export default function OfferMeetEditPage() {
  const { offerId } = getCurrentRouteParams();
  const isNewOffer = !offerId;
  const [offer, setOffer] = useState<MeetOffer | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [isLoading, setIsLoading] = useState(!isNewOffer);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isNewOffer) {
      setOffer({
        type: 'meet',
        description: '',
        location: null,
        validUntil: defaultValidUntil(),
      });
      return undefined;
    }

    let isMounted = true;

    async function loadOffer() {
      setIsLoading(true);

      try {
        const data = await getOffer(offerId);

        if (isMounted) {
          setOffer({
            ...data,
            type: 'meet',
            description: data.description || '',
            location: data.location || [
              DEFAULT_LOCATION.lat,
              DEFAULT_LOCATION.lng,
            ],
            validUntil: data.validUntil || defaultValidUntil(),
          });
        }
      } catch {
        if (isMounted) {
          setOffer(null);
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
  }, [isNewOffer, offerId]);

  const descriptionLength = useMemo(
    () => plainTextLength(offer?.description),
    [offer?.description],
  );

  const hasLocation =
    Array.isArray(offer?.location) && offer.location.length === 2;
  const hasValidExpiry = Boolean(
    offer && Number.isFinite(new Date(offer.validUntil).getTime()),
  );
  const expiryInputValue = hasValidExpiry
    ? new Date(offer!.validUntil).toISOString().slice(0, 10)
    : '';

  const loadedOffer = offer;
  if (isLoading || !loadedOffer) {
    return (
      <div className="text-center text-muted">
        <LoadingIndicator />
      </div>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !loadedOffer ||
      isSaving ||
      descriptionLength < MIN_DESCRIPTION ||
      !hasValidExpiry ||
      !hasLocation
    ) {
      return;
    }

    setIsSaving(true);

    const payload: Offer = {
      type: 'meet',
      description: loadedOffer.description,
      location: loadedOffer.location!,
      validUntil: new Date(loadedOffer.validUntil).toISOString(),
    };

    try {
      if (isNewOffer) {
        await createOffer(payload);
        trackEvent('offer-modified', {
          category: 'offer.meet.add',
          label: 'Added meet offer',
        });
      } else {
        const existingOfferId = loadedOffer._id || offerId!;
        await updateOffer(existingOfferId, payload);
        trackEvent('offer-modified', {
          category: 'offer.meet.edit',
          label: 'Modified meet offer',
        });
      }

      window.location.assign('/offer/meet');
    } catch {
      setIsSaving(false);
    }
  }

  return (
    <section className="offers-edit">
      <form autoComplete="off" noValidate onSubmit={handleSubmit}>
        {!isNewOffer && (
          <button
            className="btn btn-lg btn-inverse-primary pull-right"
            disabled={
              isSaving ||
              descriptionLength < MIN_DESCRIPTION ||
              !hasValidExpiry ||
              !hasLocation
            }
            type="submit"
          >
            Save and Exit
          </button>
        )}

        <a
          aria-label="Cancel adding a meet offer"
          className="btn btn-lg btn-inverse-primary pull-right hidden-xs"
          href="/offer/meet"
        >
          Cancel
        </a>

        <Tabs
          activeKey={activeTab}
          className="offer-tabs"
          id="offer-meet-tabs"
          onSelect={key => {
            if (key !== null) setActiveTab(Number(key));
          }}
        >
          <Tab eventKey={0} title="Details">
            <div className="row">
              <div className="col-xs-12 col-sm-6 col-sm-push-6 text-center">
                <MeetsExplanation />
              </div>
              <div className="col-xs-12 col-sm-6 col-sm-pull-6">
                <div className="panel panel-default">
                  <div className="panel-heading">
                    <h4 id="offerDescriptionLabel">
                      What is this about? <i>(required)</i>
                    </h4>
                  </div>
                  <div className="panel-body">
                    <textarea
                      aria-labelledby="offerDescriptionLabel"
                      aria-required="true"
                      className="form-control offer-description"
                      onChange={({ target: { value } }) =>
                        setOffer({ ...offer, description: value })
                      }
                      placeholder="Write here..."
                      rows={8}
                      value={loadedOffer.description || ''}
                    />
                  </div>
                </div>

                <div className="panel panel-default">
                  <div className="panel-heading">
                    <h4 id="offerVisibilityLabel">
                      How long should this be visible?
                    </h4>
                  </div>
                  <div className="panel-body text-center">
                    <input
                      aria-labelledby="offerVisibilityLabel"
                      className="form-control input-lg"
                      max={defaultValidUntil().slice(0, 10)}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={({ target: { value } }) =>
                        setOffer({ ...offer, validUntil: value })
                      }
                      type="date"
                      value={expiryInputValue}
                    />
                    {!hasValidExpiry && (
                      <p role="alert">Please choose a valid expiry date.</p>
                    )}
                    <br />
                    <br />
                    <p className="lead">
                      Visible through{' '}
                      {hasValidExpiry &&
                        new Date(loadedOffer.validUntil).toLocaleDateString(
                          undefined,
                          {
                            dateStyle: 'medium',
                          },
                        )}
                    </p>
                    <small className="text-muted">
                      You can set visibility at most one month ahead.
                    </small>
                  </div>
                </div>
              </div>
            </div>
          </Tab>
          <Tab
            disabled={descriptionLength < MIN_DESCRIPTION}
            eventKey={1}
            title="Location"
          >
            {!hasLocation && (
              <p className="alert alert-info" role="status">
                Search for a place or move the map to set your meeting location.
              </p>
            )}
            <OfferLocationEditor
              location={loadedOffer.location}
              offerType="meet"
              onLocationChange={location => setOffer({ ...offer, location })}
            />
          </Tab>
        </Tabs>

        <div className="offer-meet-actions text-center">
          <br />
          {activeTab > 0 && (
            <button
              aria-label="Previous section"
              className="btn btn-action btn-link"
              onClick={() => setActiveTab(activeTab - 1)}
              type="button"
            >
              <span className="icon-left"></span>
              Back
            </button>
          )}
          {activeTab < 1 && (
            <button
              aria-label="Next section"
              className="btn btn-action btn-primary"
              disabled={descriptionLength < MIN_DESCRIPTION}
              onClick={() => setActiveTab(activeTab + 1)}
              type="button"
            >
              Next
            </button>
          )}
          {activeTab === 1 && (
            <button
              aria-label="Finish editing and save"
              className="btn btn-action btn-primary"
              disabled={isSaving || !hasValidExpiry || !hasLocation}
              type="submit"
            >
              Finish
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

OfferMeetEditPage.propTypes = {
  user: PropTypes.object.isRequired,
};
