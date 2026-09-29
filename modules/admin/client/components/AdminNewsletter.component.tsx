// External dependencies
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';

// Internal dependencies
import {
  getNewsletterAudienceCsv,
  getNewsletterCircleSubscribersCsv,
  getNewsletterSubscribersCsv,
  previewNewsletterAudience,
  splitNewsletterSubscribers,
  type NewsletterAudienceCriteria,
} from '../api/newsletter.api';
import AdminHeader from './AdminHeader.component';
import { read as readCircles } from '@/modules/tribes/client/api/tribes.api';

const ALL_SUBSCRIBERS_FILE_NAME = 'newsletter-subscribers.csv';
const AUDIENCE_FILE_NAME = 'newsletter-audience.csv';
const CIRCLE_SUBSCRIBERS_FILE_PREFIX = 'newsletter-circle-';
const ELIGIBLE_FILE_PREFIX = 'newsletter-eligible';
const EXCLUDED_FILE_PREFIX = 'newsletter-excluded';
const AUDIENCE_COUNT_DEBOUNCE_MS = 500;
type AudienceSource = NewsletterAudienceCriteria['sources'][number];

interface CircleChoice {
  _id: string;
  label: string;
}

type ReadCircles = (options: { limit: number }) => Promise<CircleChoice[]>;

interface AudiencePreview {
  count: number;
}

interface SplitResult {
  totalEmailCount: number;
  subscribedCount: number;
  unsubscribedCount: number;
  subscribedContent: string;
  unsubscribedContent: string;
  outputFormat: 'csv' | 'jsonl' | 'ndjson';
}

function triggerDownload(
  fileName: string,
  content: string,
  contentType: string,
) {
  const contentBlob = new Blob([content], {
    type: contentType,
  });
  const objectUrl = URL.createObjectURL(contentBlob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

function triggerCsvDownload(fileName: string, csv: string) {
  triggerDownload(fileName, csv, 'text/csv;charset=utf-8;');
}

function triggerRecipientDownload(
  prefix: string,
  result: SplitResult,
  content: string,
) {
  const contentType =
    result.outputFormat === 'csv'
      ? 'text/csv;charset=utf-8;'
      : 'application/x-ndjson;charset=utf-8;';
  triggerDownload(`${prefix}.${result.outputFormat}`, content, contentType);
}

function isAudienceCriteriaReady(criteria: NewsletterAudienceCriteria) {
  if (criteria.sources.length === 0) {
    return criteria.circleIds.length > 0;
  }

  const usesTextLocation =
    criteria.sources.includes('from') || criteria.sources.includes('living');
  if (usesTextLocation && !criteria.locationText.trim()) {
    return false;
  }

  if (criteria.sources.includes('hosting')) {
    return Boolean(
      String(criteria.latitude).trim() &&
        String(criteria.longitude).trim() &&
        String(criteria.radiusKm).trim(),
    );
  }

  return true;
}

function audienceError(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = error.response as
      | { data?: { message?: string } }
      | undefined;
    return response?.data?.message || fallback;
  }
  return fallback;
}

export default function AdminNewsletter() {
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [audienceErrorMessage, setAudienceErrorMessage] = useState<
    string | null
  >(null);
  const [isAudienceCountLoading, setIsAudienceCountLoading] = useState(false);
  const [audienceCriteria, setAudienceCriteria] =
    useState<NewsletterAudienceCriteria>({
      circleIds: [],
      latitude: '',
      locationText: '',
      longitude: '',
      radiusKm: '50',
      sources: ['from', 'hosting', 'living'],
    });
  const [circles, setCircles] = useState<CircleChoice[]>([]);
  const [circlesErrorMessage, setCirclesErrorMessage] = useState<string | null>(
    null,
  );
  const [circleId, setCircleId] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [exportErrorMessage, setExportErrorMessage] = useState<string | null>(
    null,
  );
  const [isExportingAll, setIsExportingAll] = useState(false);
  const [isExportingCircle, setIsExportingCircle] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<SplitResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const audiencePreviewRequestId = useRef(0);
  const audiencePreviewTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    async function loadCircles() {
      try {
        // The JavaScript API's implementation accepts options, though its
        // JSDoc currently describes the argument as a number.
        const circleChoices = await (readCircles as unknown as ReadCircles)({
          limit: 500,
        });
        setCircles(circleChoices || []);
      } catch {
        setCirclesErrorMessage(
          'Could not load circles. Location filters are still available.',
        );
      }
    }

    loadCircles();
  }, []);

  const refreshAudienceCount = useCallback(
    async (criteria: NewsletterAudienceCriteria) => {
      const requestId = audiencePreviewRequestId.current + 1;
      audiencePreviewRequestId.current = requestId;
      setAudienceErrorMessage(null);
      setIsAudienceCountLoading(true);

      try {
        const preview: AudiencePreview = await previewNewsletterAudience(
          criteria,
        );
        if (audiencePreviewRequestId.current === requestId) {
          setAudienceCount(preview.count);
        }
      } catch (error) {
        if (audiencePreviewRequestId.current === requestId) {
          setAudienceCount(null);
          setAudienceErrorMessage(
            audienceError(error, 'Could not preview this newsletter audience.'),
          );
        }
      } finally {
        if (audiencePreviewRequestId.current === requestId) {
          setIsAudienceCountLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (audiencePreviewTimer.current !== null) {
      clearTimeout(audiencePreviewTimer.current);
    }

    if (!isAudienceCriteriaReady(audienceCriteria)) {
      setIsAudienceCountLoading(false);
      return undefined;
    }

    setIsAudienceCountLoading(true);
    const timer = setTimeout(() => {
      refreshAudienceCount(audienceCriteria);
    }, AUDIENCE_COUNT_DEBOUNCE_MS);
    audiencePreviewTimer.current = timer;

    return () => clearTimeout(timer);
  }, [audienceCriteria, refreshAudienceCount]);

  function updateAudienceCriteria(update: Partial<NewsletterAudienceCriteria>) {
    setAudienceCriteria(currentCriteria => ({
      ...currentCriteria,
      ...update,
    }));
    setAudienceCount(null);
    setAudienceErrorMessage(null);
  }

  function toggleLocationSource(source: AudienceSource) {
    const sources = audienceCriteria.sources.includes(source)
      ? audienceCriteria.sources.filter(value => value !== source)
      : [...audienceCriteria.sources, source];
    updateAudienceCriteria({ sources });
  }

  function onAudienceCirclesChange(event: ChangeEvent<HTMLSelectElement>) {
    updateAudienceCriteria({
      circleIds: Array.from(event.target.selectedOptions).map(
        option => option.value,
      ),
    });
  }

  async function onAudiencePreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (audiencePreviewTimer.current !== null) {
      clearTimeout(audiencePreviewTimer.current);
    }
    await refreshAudienceCount(audienceCriteria);
  }

  async function onAudienceExport() {
    setAudienceErrorMessage(null);

    try {
      const csv = await getNewsletterAudienceCsv(audienceCriteria);
      triggerCsvDownload(AUDIENCE_FILE_NAME, csv);
    } catch (error) {
      setAudienceErrorMessage(
        audienceError(error, 'Could not export this newsletter audience.'),
      );
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setErrorMessage('Choose a CSV, JSONL, or NDJSON file first.');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    try {
      const splitResult: SplitResult = await splitNewsletterSubscribers(
        selectedFile,
      );
      setResult(splitResult);
    } catch (error) {
      const message = audienceError(
        error,
        'Could not split newsletter subscribers from this recipient file.',
      );
      setErrorMessage(message);
      setResult(null);
    } finally {
      setIsUploading(false);
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file || null);
    setResult(null);
    setErrorMessage(null);
  }

  async function onExportAll() {
    setExportErrorMessage(null);
    setIsExportingAll(true);

    try {
      const csv = await getNewsletterSubscribersCsv();
      triggerCsvDownload(ALL_SUBSCRIBERS_FILE_NAME, csv);
    } catch (error) {
      setExportErrorMessage(
        audienceError(error, 'Could not export newsletter subscribers.'),
      );
    } finally {
      setIsExportingAll(false);
    }
  }

  async function onExportCircle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedCircleId = circleId.trim();

    if (!trimmedCircleId) {
      setExportErrorMessage('Enter a circle ID first.');
      return;
    }

    setExportErrorMessage(null);
    setIsExportingCircle(true);

    try {
      const csv = await getNewsletterCircleSubscribersCsv(trimmedCircleId);
      triggerCsvDownload(
        `${CIRCLE_SUBSCRIBERS_FILE_PREFIX}${trimmedCircleId}.csv`,
        csv,
      );
    } catch (error) {
      setExportErrorMessage(
        audienceError(
          error,
          'Could not export newsletter subscribers for this circle.',
        ),
      );
    } finally {
      setIsExportingCircle(false);
    }
  }

  const usesTextLocation =
    audienceCriteria.sources.includes('from') ||
    audienceCriteria.sources.includes('living');
  const usesHostingLocation = audienceCriteria.sources.includes('hosting');

  return (
    <>
      <AdminHeader />
      <div className="container">
        <h2>Newsletter subscribers</h2>
        <p>
          Eligible recipients are members who are public, subscribed to the
          newsletter, not suspended/shadowbanned, and not pending profile
          deletion.
        </p>

        <h3>Create a targeted audience</h3>
        <p>
          Choose location sources, circles, or both. Selected location sources
          are matched with OR; circles are matched with OR. When both groups are
          used, recipients must match a location and a circle.
        </p>

        <form onSubmit={event => onAudiencePreview(event)}>
          <fieldset>
            <legend className="h4">Location sources</legend>
            {(
              [
                ['living', 'Living location'],
                ['from', 'Origin location'],
                ['hosting', 'Hosting location'],
              ] as Array<[AudienceSource, string]>
            ).map(([value, label]) => (
              <label
                className="checkbox-inline"
                key={value}
                htmlFor={`newsletter-location-${value}`}
              >
                <input
                  checked={audienceCriteria.sources.includes(value)}
                  id={`newsletter-location-${value}`}
                  onChange={() => toggleLocationSource(value)}
                  type="checkbox"
                />{' '}
                {label}
              </label>
            ))}
          </fieldset>

          {usesTextLocation && (
            <div className="form-group" style={{ marginTop: '12px' }}>
              <label htmlFor="newsletter-location-text">Location name</label>
              <input
                className="form-control"
                id="newsletter-location-text"
                onChange={event =>
                  updateAudienceCriteria({ locationText: event.target.value })
                }
                placeholder="Berlin"
                type="text"
                value={audienceCriteria.locationText}
              />
            </div>
          )}

          {usesHostingLocation && (
            <fieldset>
              <legend className="h4">Hosting area</legend>
              <div className="row">
                <div className="col-sm-4 form-group">
                  <label htmlFor="newsletter-location-latitude">Latitude</label>
                  <input
                    className="form-control"
                    id="newsletter-location-latitude"
                    onChange={event =>
                      updateAudienceCriteria({ latitude: event.target.value })
                    }
                    placeholder="52.5200"
                    type="number"
                    step="any"
                    value={audienceCriteria.latitude}
                  />
                </div>
                <div className="col-sm-4 form-group">
                  <label htmlFor="newsletter-location-longitude">
                    Longitude
                  </label>
                  <input
                    className="form-control"
                    id="newsletter-location-longitude"
                    onChange={event =>
                      updateAudienceCriteria({ longitude: event.target.value })
                    }
                    placeholder="13.4050"
                    type="number"
                    step="any"
                    value={audienceCriteria.longitude}
                  />
                </div>
                <div className="col-sm-4 form-group">
                  <label htmlFor="newsletter-location-radius">
                    Radius (kilometres)
                  </label>
                  <input
                    className="form-control"
                    id="newsletter-location-radius"
                    min="0.1"
                    max="500"
                    onChange={event =>
                      updateAudienceCriteria({ radiusKm: event.target.value })
                    }
                    type="number"
                    step="any"
                    value={audienceCriteria.radiusKm}
                  />
                </div>
              </div>
            </fieldset>
          )}

          <div className="form-group">
            <label htmlFor="newsletter-audience-circles">
              Circles (optional)
            </label>
            <select
              className="form-control"
              id="newsletter-audience-circles"
              multiple
              onChange={onAudienceCirclesChange}
              size={8}
              value={audienceCriteria.circleIds}
            >
              {circles.map(circle => (
                <option key={circle._id} value={circle._id}>
                  {circle.label}
                </option>
              ))}
            </select>
            <p className="help-block">
              Select more than one circle with Ctrl/Command-click.
            </p>
          </div>

          {circlesErrorMessage && (
            <p className="text-warning">{circlesErrorMessage}</p>
          )}
          {audienceErrorMessage && (
            <p className="text-danger">{audienceErrorMessage}</p>
          )}

          <button className="btn btn-primary" type="submit">
            Count recipients
          </button>
          <div className="alert alert-info" style={{ marginTop: '12px' }}>
            {isAudienceCountLoading && <span>Counting recipients…</span>}
            {!isAudienceCountLoading && audienceCount === null && (
              <span>Complete the selected filters to see the match count.</span>
            )}
            {!isAudienceCountLoading && audienceCount !== null && (
              <span>
                {audienceCount} eligible recipient
                {audienceCount === 1 ? ' matches' : 's match'} these filters.
              </span>
            )}
            {audienceCount !== null && (
              <button
                className="btn btn-default"
                onClick={() => onAudienceExport()}
                style={{ marginLeft: '12px' }}
                type="button"
              >
                Export audience CSV
              </button>
            )}
          </div>
        </form>

        <h3>Export subscribers</h3>
        <p>
          <button
            className="btn btn-default"
            disabled={isExportingAll || isExportingCircle}
            onClick={() => onExportAll()}
            type="button"
          >
            {isExportingAll ? 'Exporting…' : 'Export all subscribers CSV'}
          </button>
        </p>

        <form className="form-inline" onSubmit={event => onExportCircle(event)}>
          <label className="sr-only" htmlFor="newsletter-circle-id">
            Circle ID
          </label>
          <input
            aria-label="Circle ID"
            className="form-control"
            id="newsletter-circle-id"
            onChange={event => setCircleId(event.target.value)}
            placeholder="Circle ID"
            type="text"
            value={circleId}
          />
          <button
            className="btn btn-default"
            disabled={isExportingAll || isExportingCircle}
            style={{ marginLeft: '8px' }}
            type="submit"
          >
            {isExportingCircle ? 'Exporting…' : 'Export circle subscribers CSV'}
          </button>
        </form>

        {exportErrorMessage && (
          <p className="text-danger" style={{ marginTop: '12px' }}>
            {exportErrorMessage}
          </p>
        )}

        <h3>Check a recipient list</h3>
        <p>
          Upload CSV, JSONL, or NDJSON. You will get one eligible list and one
          excluded list with reasons, using the same file format.
        </p>

        <form onSubmit={event => onSubmit(event)}>
          <div className="form-group">
            <label htmlFor="newsletter-recipient-file">
              Recipient file (CSV, JSONL, or NDJSON)
            </label>
            <input
              accept=".csv,.jsonl,.ndjson,text/csv,application/x-ndjson,application/ndjson"
              className="form-control"
              id="newsletter-recipient-file"
              name="newsletterCsv"
              onChange={event => onFileChange(event)}
              type="file"
            />
            <p className="help-block">
              JSON Lines can contain email strings or objects with an email,
              emailAddress, or address field.
            </p>
          </div>
          <button
            className="btn btn-default"
            disabled={isUploading}
            type="submit"
          >
            {isUploading ? 'Checking…' : 'Check recipients'}
          </button>
        </form>

        {errorMessage && (
          <p className="text-danger" style={{ marginTop: '12px' }}>
            {errorMessage}
          </p>
        )}

        {result && (
          <div style={{ marginTop: '16px' }}>
            <p>
              Processed {result.totalEmailCount} emails:{' '}
              {result.subscribedCount} eligible and {result.unsubscribedCount}{' '}
              excluded.
            </p>
            <p>
              <button
                className="btn btn-default"
                onClick={() =>
                  triggerRecipientDownload(
                    ELIGIBLE_FILE_PREFIX,
                    result,
                    result.subscribedContent,
                  )
                }
                type="button"
              >
                Download eligible {result.outputFormat.toUpperCase()}
              </button>{' '}
              <button
                className="btn btn-default"
                onClick={() =>
                  triggerRecipientDownload(
                    EXCLUDED_FILE_PREFIX,
                    result,
                    result.unsubscribedContent,
                  )
                }
                type="button"
              >
                Download excluded {result.outputFormat.toUpperCase()}
              </button>
            </p>
          </div>
        )}
      </div>
    </>
  );
}

AdminNewsletter.propTypes = {};
