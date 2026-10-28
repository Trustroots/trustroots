import React, { useRef, useState } from 'react';
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
  'ambiguous-source-match':
    'Several Zendesk tickets match different email renderings of one local request',
  'ticket-id-conflict':
    'A request or Zendesk ticket is already linked elsewhere',
  'newer-local-activity': 'The local request has newer activity',
};

async function previewManifest(
  manifest: SupportStatusImportManifest,
  matchingWindowMinutes: number,
) {
  const { data } =
    matchingWindowMinutes === 1
      ? await http.post<SupportStatusImportPreviewResponse>(
          '/api/admin/support-import/preview',
          manifest,
        )
      : await http.post<SupportStatusImportPreviewResponse>(
          '/api/admin/support-import/preview',
          manifest,
          { params: { matchingWindowMinutes } },
        );
  return data;
}

async function applyStatusPreview(
  previewId: string,
  selectedMatches: { zendeskTicketId: number; requestId: string }[],
) {
  const { data } = await http.post<SupportStatusImportApplyResponse>(
    '/api/admin/support-import/apply',
    { previewId, selectedMatches },
  );
  return data;
}

export default function SupportStatusImport({
  onApplied,
}: {
  onApplied?: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [matchingWindowMinutes, setMatchingWindowMinutes] = useState(1);
  const previewGeneration = useRef(0);
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
  const [selectedMatches, setSelectedMatches] = useState<
    Record<number, string>
  >({});

  if (!getCurrentUser()?.roles?.includes('admin')) return null;

  async function reviewFile(file: File) {
    const generation = ++previewGeneration.current;
    setError('');
    setResult(null);
    setPreview(null);
    setMatchingSkips({});
    setSelectedMatches({});
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
        (parsed.version !== 1 && parsed.version !== 2) ||
        !('items' in parsed) ||
        !Array.isArray(parsed.items)
      ) {
        throw new Error('invalid manifest');
      }
      const reviewed = await previewManifest(
        parsed as SupportStatusImportManifest,
        matchingWindowMinutes,
      );
      if (generation !== previewGeneration.current) return;
      setPreview(reviewed);
      setMatchingSkips(reviewed.counts.skippedByReason);
      setSelectedMatches({});
    } catch (cause) {
      if (generation !== previewGeneration.current) return;
      setError(
        cause instanceof Error && cause.message === 'invalid manifest'
          ? 'Choose a valid reduced status manifest.'
          : getErrorMessage(
              cause,
              'Unable to read this manifest. Choose a valid reduced JSON file.',
            ),
      );
    } finally {
      if (generation === previewGeneration.current) setWorking(false);
    }
  }

  async function applyPreview(previewId: string) {
    setError('');
    setWorking(true);
    try {
      const applied = await applyStatusPreview(
        previewId,
        Object.entries(selectedMatches).map(([ticketId, requestId]) => ({
          zendeskTicketId: Number(ticketId),
          requestId,
        })),
      );
      setResult(applied);
      setPreview(null);
      onApplied?.();
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
          previewGeneration.current += 1;
          setWorking(false);
          setFile(event.target.files?.[0] || null);
          setPreview(null);
          setResult(null);
          setError('');
          setMatchingSkips({});
          setSelectedMatches({});
        }}
      />
      <label htmlFor="support-status-import-window">
        Submission-time matching window (minutes)
      </label>
      <input
        className="form-control"
        id="support-status-import-window"
        type="range"
        min={1}
        max={60}
        step={1}
        value={matchingWindowMinutes}
        disabled={working}
        onChange={event => {
          const value = Number(event.target.value);
          previewGeneration.current += 1;
          setWorking(false);
          setMatchingWindowMinutes(value);
          setPreview(null);
          setResult(null);
          setError('');
          setMatchingSkips({});
          setSelectedMatches({});
        }}
      />
      <p>
        Chosen submission-time window: {matchingWindowMinutes} minute
        {matchingWindowMinutes === 1 ? '' : 's'}.
      </p>
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
            . {preview.counts.suggested || 0} ticket
            {preview.counts.suggested === 1 ? '' : 's'} with suggestions.
          </p>
          {preview.changes.length > 0 && (
            <details>
              <summary>Exact matches ({preview.changes.length})</summary>
              <div className="table-responsive">
                <table className="table table-striped">
                  <thead>
                    <tr>
                      <th>Request</th>
                      <th>Zendesk ticket</th>
                      <th>Current status</th>
                      <th>Imported status</th>
                      <th>Match</th>
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
                        <td>Exact: {change.reason}</td>
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
            </details>
          )}
          {(preview.matchReviews || []).length > 0 && (
            <section aria-label="Suggested request matches">
              <h3>Suggested matches need your review</h3>
              <p>
                Suggestions require the same original sender and category, a
                submission within{' '}
                {preview.matchingWindowMinutes ?? matchingWindowMinutes} minute
                {(preview.matchingWindowMinutes ?? matchingWindowMinutes) === 1
                  ? ''
                  : 's'}
                , and an equivalent message after formatting cleanup. Review the
                local requester details and select at most one request for each
                ticket. Ambiguous and shared targets stay unselected until you
                review them.
              </p>
              <p role="status">
                {Object.keys(selectedMatches).length} selected
              </p>
              <button
                className="btn btn-default"
                type="button"
                disabled={working}
                onClick={() => {
                  const targetCounts = new Map<string, number>();
                  for (const review of preview.matchReviews)
                    for (const candidate of review.candidates)
                      targetCounts.set(
                        candidate.requestId,
                        (targetCounts.get(candidate.requestId) || 0) + 1,
                      );
                  const exactTargets = new Set(
                    preview.changes.map(change => change.requestId),
                  );
                  const next: Record<number, string> = { ...selectedMatches };
                  const alreadySelected = new Set(Object.values(next));
                  for (const review of preview.matchReviews) {
                    if (review.candidates.length !== 1) continue;
                    const [candidate] = review.candidates;
                    if (
                      targetCounts.get(candidate.requestId) !== 1 ||
                      exactTargets.has(candidate.requestId) ||
                      next[review.zendeskTicketId] ||
                      alreadySelected.has(candidate.requestId)
                    )
                      continue;
                    next[review.zendeskTicketId] = candidate.requestId;
                    alreadySelected.add(candidate.requestId);
                  }
                  setSelectedMatches(next);
                }}
              >
                Select all unambiguous matches
              </button>{' '}
              <button
                className="btn btn-default"
                type="button"
                disabled={working || Object.keys(selectedMatches).length === 0}
                onClick={() => setSelectedMatches({})}
              >
                Clear selection
              </button>
              {preview.matchReviews.map(review => (
                <div key={review.zendeskTicketId}>
                  <h4>
                    Zendesk ticket {review.zendeskTicketId} · {review.category}{' '}
                    · submitted{' '}
                    {review.submittedAt
                      ? new Date(review.submittedAt).toLocaleString()
                      : 'time unavailable'}
                  </h4>
                  <ul>
                    {review.candidates.map(candidate => {
                      const isSelected =
                        selectedMatches[review.zendeskTicketId] ===
                        candidate.requestId;
                      const selectedForAnotherTicket = Object.entries(
                        selectedMatches,
                      ).some(
                        ([ticketId, requestId]) =>
                          requestId === candidate.requestId &&
                          Number(ticketId) !== review.zendeskTicketId,
                      );
                      return (
                        <li key={candidate.requestId}>
                          <label>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={working || selectedForAnotherTicket}
                              onChange={() =>
                                setSelectedMatches(current => {
                                  const next = { ...current };
                                  if (isSelected)
                                    delete next[review.zendeskTicketId];
                                  else
                                    next[review.zendeskTicketId] =
                                      candidate.requestId;
                                  return next;
                                })
                              }
                            />{' '}
                            <a
                              href={`/admin/support/requests/${encodeURIComponent(candidate.requestId)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Request {candidate.requestId}
                            </a>{' '}
                            ({candidate.category}; submitted{' '}
                            {candidate.submittedAt
                              ? new Date(candidate.submittedAt).toLocaleString()
                              : 'time unavailable'}
                            ){' '}
                            {candidate.senderUsername && (
                              <a
                                href={`/admin/user/${encodeURIComponent(candidate.senderUsername)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                @{candidate.senderUsername}
                              </a>
                            )}{' '}
                            {candidate.email && <span>{candidate.email}</span>}{' '}
                            {candidate.subject && (
                              <span>{candidate.subject}</span>
                            )}{' '}
                            <span>
                              Current: {candidate.currentStatus}; imported:{' '}
                              {candidate.importedStatus}.
                            </span>
                          </label>
                          {(candidate.senderUsername || candidate.email) && (
                            <p>
                              Local requester:{' '}
                              {candidate.senderUsername && (
                                <a
                                  href={`/admin/user/${encodeURIComponent(candidate.senderUsername)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  @{candidate.senderUsername}
                                </a>
                              )}
                              {candidate.senderUsername &&
                                candidate.email &&
                                ' · '}
                              {candidate.email}
                            </p>
                          )}
                          {candidate.subject && (
                            <p>Subject: {candidate.subject}</p>
                          )}
                          {selectedForAnotherTicket && (
                            <p>
                              This request is already selected for another
                              Zendesk ticket.
                            </p>
                          )}
                          <p>
                            {candidate.reason}. Submission times differ by{' '}
                            {candidate.timeDifferenceSeconds} seconds.{' '}
                            {candidate.competingCandidateCount > 1 &&
                              `${candidate.competingCandidateCount} candidates compete for this match.`}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </section>
          )}
          <button
            className="btn btn-primary"
            type="button"
            disabled={
              working ||
              (preview.counts.eligible === 0 &&
                Object.keys(selectedMatches).length === 0)
            }
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
