import PropTypes from 'prop-types';
import React, { useEffect, useMemo, useState } from 'react';
import { Tab, Tabs } from 'react-bootstrap';

import {
  getCurrentRouteParams,
  trackEvent,
} from '@/modules/core/client/services/client-runtime';
import { DEFAULT_LOCATION } from '@/modules/core/client/utils/constants';
import LoadingIndicator from '@/modules/core/client/components/LoadingIndicator';
import { createOffer, getOffer, updateOffer } from '../api/offers.api';
import MeetsExplanation from './MeetsExplanation.component';
import OfferLocationEditor from './OfferLocationEditor.component';

const MIN_DESCRIPTION = 5;

function plainTextLength(value = '') {
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
  const [offer, setOffer] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [isLoading, setIsLoading] = useState(!isNewOffer);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isNewOffer) {
      setOffer({
        description: '',
        location: [DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng],
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
          setOffer(data);
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

  if (isLoading || !offer) {
    return (
      <div className="text-center text-muted">
        <LoadingIndicator />
      </div>
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (isSaving || descriptionLength < MIN_DESCRIPTION) {
      return;
    }

    setIsSaving(true);

    const payload = {
      type: 'meet',
      description: offer.description,
      location: offer.location,
      validUntil: offer.validUntil,
    };

    try {
      if (isNewOffer) {
        await createOffer(payload);
        trackEvent('offer-modified', {
          category: 'offer.meet.add',
          label: 'Added meet offer',
        });
      } else {
        await updateOffer(offer._id, payload);
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
            aria-hidden="true"
            className="btn btn-lg btn-inverse-primary pull-right hidden-xs"
            disabled={isSaving || descriptionLength < MIN_DESCRIPTION}
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
          onSelect={setActiveTab}
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
                        setOffer(current => ({
                          ...current,
                          description: value,
                        }))
                      }
                      placeholder="Write here..."
                      rows={8}
                      value={offer.description || ''}
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
                        setOffer(current => ({
                          ...current,
                          validUntil: new Date(value).toISOString(),
                        }))
                      }
                      type="date"
                      value={
                        /* istanbul ignore next -- persisted meet offers always have an expiry. */
                        (offer.validUntil || defaultValidUntil()).slice(0, 10)
                      }
                    />
                    <br />
                    <br />
                    <p className="lead">
                      Visible through{' '}
                      {new Date(offer.validUntil).toLocaleDateString(
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
            <OfferLocationEditor
              location={offer.location}
              offerType="meet"
              onLocationChange={location =>
                setOffer(current => ({ ...current, location }))
              }
            />
          </Tab>
        </Tabs>

        <div className="text-center hidden-xs">
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
              disabled={isSaving}
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
