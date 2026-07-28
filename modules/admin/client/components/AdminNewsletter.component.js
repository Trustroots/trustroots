// External dependencies
import React, { useState } from 'react';

// Internal dependencies
import {
  getNewsletterCircleSubscribersCsv,
  getNewsletterSubscribersCsv,
  splitNewsletterSubscribers,
} from '../api/newsletter.api';
import AdminHeader from './AdminHeader.component';

const ALL_SUBSCRIBERS_FILE_NAME = 'newsletter-subscribers.csv';
const CIRCLE_SUBSCRIBERS_FILE_PREFIX = 'newsletter-circle-';
const SUBSCRIBED_FILE_NAME = 'newsletter-still-subscribed.csv';
const UNSUBSCRIBED_FILE_NAME = 'newsletter-unsubscribed.csv';

function triggerCsvDownload(fileName, csv) {
  const csvBlob = new Blob([csv], {
    type: 'text/csv;charset=utf-8;',
  });
  const objectUrl = URL.createObjectURL(csvBlob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export default function AdminNewsletter() {
  const [circleId, setCircleId] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [exportErrorMessage, setExportErrorMessage] = useState(null);
  const [isExportingAll, setIsExportingAll] = useState(false);
  const [isExportingCircle, setIsExportingCircle] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  async function onSubmit(event) {
    event.preventDefault();

    if (!selectedFile) {
      setErrorMessage('Choose a CSV file first.');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    try {
      const splitResult = await splitNewsletterSubscribers(selectedFile);
      setResult(splitResult);
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        'Could not split newsletter subscribers from this CSV file.';
      setErrorMessage(message);
      setResult(null);
    } finally {
      setIsUploading(false);
    }
  }

  function onFileChange(event) {
    const [file] = event.target.files || [];
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
      const message =
        error?.response?.data?.message ||
        'Could not export newsletter subscribers.';
      setExportErrorMessage(message);
    } finally {
      setIsExportingAll(false);
    }
  }

  async function onExportCircle(event) {
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
      const message =
        error?.response?.data?.message ||
        'Could not export newsletter subscribers for this circle.';
      setExportErrorMessage(message);
    } finally {
      setIsExportingCircle(false);
    }
  }

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

        <h3>Split uploaded CSV recipients</h3>
        <p>
          Upload a CSV of recipient email addresses and split it into two
          downloadable CSV files: still subscribed and unsubscribed.
        </p>

        <form className="form-inline" onSubmit={event => onSubmit(event)}>
          <label className="sr-only" htmlFor="newsletter-csv-file">
            Newsletter CSV file
          </label>
          <input
            accept=".csv,text/csv"
            className="form-control"
            id="newsletter-csv-file"
            name="newsletterCsv"
            onChange={event => onFileChange(event)}
            type="file"
          />
          <button
            className="btn btn-default"
            disabled={isUploading}
            style={{ marginLeft: '8px' }}
            type="submit"
          >
            {isUploading ? 'Splitting…' : 'Split recipients'}
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
              {result.subscribedCount} still subscribed and{' '}
              {result.unsubscribedCount} unsubscribed.
            </p>
            <p>
              <button
                className="btn btn-default"
                onClick={() =>
                  triggerCsvDownload(SUBSCRIBED_FILE_NAME, result.subscribedCsv)
                }
                type="button"
              >
                Download still subscribed CSV
              </button>{' '}
              <button
                className="btn btn-default"
                onClick={() =>
                  triggerCsvDownload(
                    UNSUBSCRIBED_FILE_NAME,
                    result.unsubscribedCsv,
                  )
                }
                type="button"
              >
                Download unsubscribed CSV
              </button>
            </p>
          </div>
        )}
      </div>
    </>
  );
}

AdminNewsletter.propTypes = {};
