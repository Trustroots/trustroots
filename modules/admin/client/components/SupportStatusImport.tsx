import React, { useState } from 'react';
import http, { getErrorMessage } from '../../../core/client/api/http-client';
import { getCurrentUser } from '../../../core/client/services/client-runtime';
import type {
  SupportStatusImportApplyResponse,
  SupportStatusImportManifest,
  SupportStatusImportPreviewResponse,
} from '../../../support/shared/status-import';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const SKIP_REASON_LABELS: Record<string, string> = {
  'duplicate-ticket-id': 'Repeated Zendesk ticket ID in the manifest',
  'duplicate-fingerprint':
    'Several Zendesk tickets have the same original request',
  'no-match':
    'No local request matches the original category, email and message',
  'ambiguous-match': 'Several local requests match the same original request',
  'ticket-id-conflict':
    'A request or Zendesk ticket is already linked elsewhere',
  'newer-local-activity': 'The local request has newer activity',
};

async function previewManifest(manifest: SupportStatusImportManifest) {
  const { data } = await http.post<SupportStatusImportPreviewResponse>(
    '/api/admin/support-import/preview',
    manifest,
  );
  return data;
}

async function applyStatusPreview(previewId: string) {
  const { data } = await http.post<SupportStatusImportApplyResponse>(
    '/api/admin/support-import/apply',
    { previewId },
  );
  return data;
}

export default function SupportStatusImport() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] =
    useState<SupportStatusImportPreviewResponse | null>(null);
  const [result, setResult] = useState<SupportStatusImportApplyResponse | null>(
    null,
  );
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [matchingSkips, setMatchingSkips] = useState<Record<string, number>>(
    {},
  );

  if (!getCurrentUser()?.roles?.includes('admin')) return null;

  async function reviewFile(file: File) {
    setError('');
    setResult(null);
    setPreview(null);
    setMatchingSkips({});
    if (file.size > MAX_UPLOAD_BYTES) {
      setError('Choose a reduced JSON manifest no larger than 10 MiB.');
      return;
    }
    setWorking(true);
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        Array.isArray(parsed) ||
        !('version' in parsed) ||
        parsed.version !== 1 ||
        !('items' in parsed) ||
        !Array.isArray(parsed.items)
      ) {
        throw new Error('invalid manifest');
      }
      const reviewed = await previewManifest(
        parsed as SupportStatusImportManifest,
      );
      setPreview(reviewed);
      setMatchingSkips(reviewed.counts.skippedByReason);
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message === 'invalid manifest'
          ? 'Choose a valid reduced status manifest.'
          : getErrorMessage(
              cause,
              'Unable to read this manifest. Choose a valid reduced JSON file.',
            ),
      );
    } finally {
      setWorking(false);
    }
  }

  async function applyPreview(previewId: string) {
    setError('');
    setWorking(true);
    try {
      setResult(await applyStatusPreview(previewId));
      setPreview(null);
    } catch (cause) {
      setError(
        getErrorMessage(cause, 'Unable to apply these support statuses.'),
      );
    } finally {
      setWorking(false);
    }
  }

  return (
    <section
      className="support-inbox__card support-status-import"
      aria-label="Zendesk status import"
    >
      <h2>Import historical statuses</h2>
      <p>
        Select a reduced JSON manifest prepared locally from the Zendesk export.
        The export itself must not be uploaded.
      </p>
      <label htmlFor="support-status-import-file">Reduced JSON manifest</label>
      <input
        className="form-control"
        id="support-status-import-file"
        type="file"
        accept=".json,application/json"
        disabled={working}
        onChange={event => {
          setFile(event.target.files?.[0] || null);
          setPreview(null);
          setResult(null);
          setError('');
          setMatchingSkips({});
        }}
      />
      <button
        className="btn btn-default"
        type="button"
        disabled={!file || working}
        onClick={file ? () => reviewFile(file) : undefined}
      >
        {working && !preview ? 'Preparing preview…' : 'Preview status changes'}
      </button>
      {error && <p role="alert">{error}</p>}
      {Object.keys(matchingSkips).length > 0 && (
        <div className="table-responsive">
          <table className="table table-striped">
            <caption>Skipped during matching</caption>
            <thead>
              <tr>
                <th scope="col">Reason</th>
                <th scope="col">Tickets</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(matchingSkips).map(([reason, count]) => (
                <tr key={reason}>
                  <td>{SKIP_REASON_LABELS[reason] || reason}</td>
                  <td>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            These tickets were left unchanged. Local requests without an
            imported status can still appear as Open. Previewing this file again
            shows the current matching reasons without applying changes.
          </p>
        </div>
      )}
      {preview && (
        <div className="support-status-import__preview" aria-live="polite">
          <p role="status">
            Preview: {preview.counts.eligible} eligible,{' '}
            {preview.counts.alreadyApplied} already applied,{' '}
            {preview.counts.skipped} skipped. Expires{' '}
            <time dateTime={preview.expiresAt}>
              {new Date(preview.expiresAt).toLocaleString()}
            </time>
            .
          </p>
          {preview.changes.length > 0 && (
            <div className="table-responsive">
              <table className="table table-striped">
                <thead>
                  <tr>
                    <th>Request</th>
                    <th>Zendesk ticket</th>
                    <th>Current status</th>
                    <th>Imported status</th>
                    <th>Zendesk updated</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.changes.map(change => (
                    <tr key={change.requestId}>
                      <td>{change.requestId}</td>
                      <td>{change.zendeskTicketId}</td>
                      <td>{change.currentStatus}</td>
                      <td>{change.importedStatus}</td>
                      <td>
                        <time dateTime={change.updatedAt}>
                          {new Date(change.updatedAt).toLocaleString()}
                        </time>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button
            className="btn btn-primary"
            type="button"
            disabled={working || preview.counts.eligible === 0}
            onClick={() => applyPreview(preview.previewId)}
          >
            {working ? 'Applying…' : 'Apply status changes'}
          </button>
        </div>
      )}
      {result && (
        <p role="status">
          Applied {result.applied}; already applied {result.alreadyApplied};
          skipped {result.skipped}.
        </p>
      )}
    </section>
  );
}
