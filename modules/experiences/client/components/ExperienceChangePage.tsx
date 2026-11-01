import React, { useEffect, useState } from 'react';
import { useSearch } from '@tanstack/react-router';

import * as api from '../api/experience-changes.api';
import LoadingIndicator from '@/modules/core/client/components/LoadingIndicator';
import { getErrorResponse } from '@/modules/core/client/api/http-client';
import type {
  ExperienceChangeAccess,
  ExperienceChangeRequestSummary,
  ExperienceChangeSubmissionResult,
} from '../../shared/experience-change';
import type {
  ExperienceInteractions,
  ExperienceRecommendation,
} from '../../shared/experience';

const emptyInteractions = (): ExperienceInteractions => ({
  met: false,
  guest: false,
  host: false,
});

function errorMessage(error: unknown): string {
  const responseData: unknown = getErrorResponse(error)?.data;
  if (
    typeof responseData === 'object' &&
    responseData !== null &&
    'message' in responseData &&
    typeof responseData.message === 'string'
  ) {
    return responseData.message || 'Could not submit your request.';
  }
  return 'Could not submit your request.';
}

interface ExperienceChangePageProps {
  id: string;
}

export default function ExperienceChangePage({
  id,
}: ExperienceChangePageProps): React.JSX.Element {
  const secret = useSearch({ strict: false }).secret || '';
  const [experience, setExperience] = useState<ExperienceChangeAccess | null>(
    null,
  );
  const [request, setRequest] = useState<
    ExperienceChangeRequestSummary | ExperienceChangeSubmissionResult | null
  >(null);
  const [accessError, setAccessError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackPublic, setFeedbackPublic] = useState('');
  const [recommend, setRecommend] =
    useState<ExperienceRecommendation>('unknown');
  const [interactions, setInteractions] =
    useState<ExperienceInteractions>(emptyInteractions);

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([api.readAccess(id, secret), api.readMine(id)]).then(
      ([access, mine]) => {
        if (!mounted) return;
        if (access.status === 'fulfilled') {
          setExperience(access.value);
          setFeedbackPublic(access.value.feedbackPublic || '');
          setRecommend(access.value.recommend || 'unknown');
          setInteractions(access.value.interactions || emptyInteractions());
        } else {
          setAccessError(
            'This link is invalid or has expired. Ask support for a new link.',
          );
        }
        if (mine.status === 'fulfilled') setRequest(mine.value);
        setLoading(false);
      },
    );
    return () => {
      mounted = false;
    };
  }, [id, secret]);

  const submit = async (kind: 'edit' | 'remove'): Promise<void> => {
    setSubmitError('');
    setSubmitting(true);
    try {
      const payload =
        kind === 'edit'
          ? { kind, proposed: { feedbackPublic, recommend, interactions } }
          : { kind };
      setRequest(await api.submit(id, secret, payload));
    } catch (error: unknown) {
      setSubmitError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container container-spacer">
        <LoadingIndicator />
      </div>
    );
  }

  return (
    <div className="container container-spacer">
      <h1>Change an Experience</h1>
      {request && (
        <p role="status">
          Your {request.kind === 'edit' ? 'edit' : 'removal'} request is{' '}
          {request.status === 'pending'
            ? 'awaiting admin review'
            : request.status === 'processing'
              ? 'being approved'
              : request.status}
          .
        </p>
      )}
      {accessError && <p className="alert alert-warning">{accessError}</p>}
      {experience &&
        !['pending', 'processing'].includes(request?.status || '') && (
          <>
            {experience.canEdit && (
              <form
                onSubmit={event => {
                  event.preventDefault();
                  void submit('edit');
                }}
              >
                <h2>Propose an edit</h2>
                <p>
                  Your current Experience will stay unchanged until an admin
                  accepts your request.
                </p>
                <div className="form-group">
                  <label htmlFor="experience-change-feedback">
                    Written feedback
                  </label>
                  <textarea
                    className="form-control"
                    id="experience-change-feedback"
                    maxLength={2000}
                    value={feedbackPublic}
                    onChange={event => setFeedbackPublic(event.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="experience-change-recommend">
                    Recommendation
                  </label>
                  <select
                    className="form-control"
                    id="experience-change-recommend"
                    value={recommend}
                    onChange={event =>
                      setRecommend(
                        event.target.value as ExperienceRecommendation,
                      )
                    }
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                    <option value="unknown">Unsure</option>
                  </select>
                </div>
                <fieldset>
                  <legend>How do you know them?</legend>
                  {(
                    [
                      ['met', 'Met in person'],
                      ['host', 'I hosted them'],
                      ['guest', 'They hosted me'],
                    ] as const
                  ).map(([key, label]) => (
                    <div className="checkbox" key={key}>
                      <label>
                        <input
                          type="checkbox"
                          checked={interactions[key]}
                          onChange={() =>
                            setInteractions(current => ({
                              ...current,
                              [key]: !current[key],
                            }))
                          }
                        />{' '}
                        {label}
                      </label>
                    </div>
                  ))}
                </fieldset>
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={
                    submitting || !Object.values(interactions).some(Boolean)
                  }
                >
                  Request edit
                </button>
              </form>
            )}
            <hr />
            <h2>Request removal</h2>
            <p>
              The Experience will remain visible under its current rules until
              an admin accepts your request.
            </p>
            <button
              className="btn btn-default"
              type="button"
              disabled={submitting}
              onClick={() => void submit('remove')}
            >
              Request removal
            </button>
          </>
        )}
      {submitError && (
        <p className="alert alert-danger" role="alert">
          {submitError}
        </p>
      )}
    </div>
  );
}
