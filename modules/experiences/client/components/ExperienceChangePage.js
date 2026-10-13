import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';

import * as api from '../api/experience-changes.api';
import LoadingIndicator from '@/modules/core/client/components/LoadingIndicator';

function errorMessage(error) {
  return error.response?.data?.message || 'Could not submit your request.';
}

export default function ExperienceChangePage({ id }) {
  const secret =
    new URLSearchParams(window.location.search).get('secret') || '';
  const [experience, setExperience] = useState(null);
  const [request, setRequest] = useState(null);
  const [accessError, setAccessError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackPublic, setFeedbackPublic] = useState('');
  const [recommend, setRecommend] = useState('unknown');
  const [interactions, setInteractions] = useState({
    met: false,
    guest: false,
    host: false,
  });

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([api.readAccess(id, secret), api.readMine(id)]).then(
      ([access, mine]) => {
        if (!mounted) return;
        if (access.status === 'fulfilled') {
          setExperience(access.value);
          setFeedbackPublic(access.value.feedbackPublic || '');
          setRecommend(access.value.recommend || 'unknown');
          setInteractions(
            access.value.interactions || {
              met: false,
              guest: false,
              host: false,
            },
          );
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

  const submit = async kind => {
    setSubmitError('');
    setSubmitting(true);
    try {
      const payload =
        kind === 'edit'
          ? { kind, proposed: { feedbackPublic, recommend, interactions } }
          : { kind };
      setRequest(await api.submit(id, secret, payload));
    } catch (error) {
      setSubmitError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingIndicator />;

  return (
    <div className="container">
      <h1>Change an Experience</h1>
      {request && (
        <p role="status">
          Your {request.kind === 'edit' ? 'edit' : 'removal'} request is{' '}
          {request.status === 'pending'
            ? 'awaiting admin review'
            : request.status}
          .
        </p>
      )}
      {accessError && <p className="alert alert-warning">{accessError}</p>}
      {experience && request?.status !== 'pending' && (
        <>
          {experience.canEdit && (
            <form
              onSubmit={event => {
                event.preventDefault();
                submit('edit');
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
                  onChange={event => setRecommend(event.target.value)}
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                  <option value="unknown">Unsure</option>
                </select>
              </div>
              <fieldset>
                <legend>How do you know them?</legend>
                {[
                  ['met', 'Met in person'],
                  ['host', 'I hosted them'],
                  ['guest', 'They hosted me'],
                ].map(([key, label]) => (
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
            The Experience will remain visible under its current rules until an
            admin accepts your request.
          </p>
          <button
            className="btn btn-default"
            type="button"
            disabled={submitting}
            onClick={() => submit('remove')}
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

ExperienceChangePage.propTypes = {
  id: PropTypes.string.isRequired,
};
