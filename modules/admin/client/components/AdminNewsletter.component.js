// External dependencies
import React, { useState } from 'react';

// Internal dependencies
import { splitNewsletterSubscribers } from '../api/newsletter.api';
import AdminHeader from './AdminHeader.component';

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
  const [errorMessage, setErrorMessage] = useState(null);
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

  return (
    <>
      <AdminHeader />
      <div className="container">
        <h2>Newsletter subscribers</h2>
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
