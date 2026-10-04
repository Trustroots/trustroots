import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';

import * as api from '../api/admin-experience-changes.api';
import AdminHeader from './AdminHeader.component';

function memberLabel(member) {
  return member?.displayName || member?.username || 'Unknown member';
}

function ExperienceDetails({ experience }) {
  if (!experience) return <p>Experience no longer available.</p>;
  return (
    <div>
      <p>
        <strong>{memberLabel(experience.userFrom)}</strong> wrote about{' '}
        <strong>{memberLabel(experience.userTo)}</strong>
        {experience.public ? ' (public)' : ' (not yet public)'}.
      </p>
      <p>Recommendation: {experience.recommend}</p>
      <p>
        Interactions:{' '}
        {['met', 'host', 'guest']
          .filter(key => experience.interactions?.[key])
          .join(', ')}
      </p>
      <p>Feedback: {experience.feedbackPublic || '(none)'}</p>
    </div>
  );
}

ExperienceDetails.propTypes = {
  experience: PropTypes.object,
};

export default function AdminExperienceChanges() {
  const [username, setUsername] = useState('');
  const [experiences, setExperiences] = useState([]);
  const [requests, setRequests] = useState([]);
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function refreshRequests() {
    setRequests(await api.listRequests());
  }

  useEffect(() => {
    refreshRequests().catch(() => setError('Could not load change requests.'));
  }, []);

  async function search(event) {
    event.preventDefault();
    setError('');
    try {
      setExperiences(await api.findExperiences(username));
    } catch {
      setError('Could not find Experiences for this member.');
    }
  }

  async function createLink(experience, member) {
    setError('');
    setBusy(true);
    try {
      const { path } = await api.issueLink(experience._id, member._id);
      const url = new URL(path, window.location.origin).href;
      setLink(url);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url).catch(() => {});
      }
    } catch {
      setError('Could not create the link.');
    } finally {
      setBusy(false);
    }
  }

  async function decide(request, decision) {
    setError('');
    setBusy(true);
    try {
      await api.decide(request._id, decision);
      await refreshRequests();
    } catch {
      setError('Could not save the decision.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AdminHeader />
      <div className="container">
        <h1>Experience changes</h1>
        {error && (
          <p className="alert alert-danger" role="alert">
            {error}
          </p>
        )}
        <section>
          <h2>Create a support link</h2>
          <form className="form-inline" onSubmit={search}>
            <label htmlFor="experience-member-username">Member username</label>{' '}
            <input
              className="form-control"
              id="experience-member-username"
              value={username}
              onChange={event => setUsername(event.target.value)}
            />{' '}
            <button className="btn btn-default" type="submit">
              Find Experiences
            </button>
          </form>
          {experiences.map(experience => (
            <div className="panel panel-default" key={experience._id}>
              <div className="panel-body">
                <ExperienceDetails experience={experience} />
                <button
                  className="btn btn-default"
                  type="button"
                  disabled={busy}
                  onClick={() => createLink(experience, experience.userFrom)}
                >
                  Copy link for author
                </button>{' '}
                <button
                  className="btn btn-default"
                  type="button"
                  disabled={busy}
                  onClick={() => createLink(experience, experience.userTo)}
                >
                  Copy link for profile owner
                </button>
              </div>
            </div>
          ))}
          {link && (
            <div className="form-group">
              <label htmlFor="experience-change-link">
                Support link (expires in seven days)
              </label>
              <input
                className="form-control"
                id="experience-change-link"
                readOnly
                value={link}
                onFocus={event => event.target.select()}
              />
            </div>
          )}
        </section>
        <section>
          <h2>Pending requests</h2>
          {requests.length === 0 && <p>No requests awaiting review.</p>}
          {requests.map(request => (
            <div className="panel panel-default" key={request._id}>
              <div className="panel-body">
                <p>
                  <strong>{memberLabel(request.requester)}</strong> requests{' '}
                  {request.kind === 'edit' ? 'an edit' : 'removal'}.
                </p>
                <ExperienceDetails experience={request.experience} />
                {request.kind === 'edit' && (
                  <div>
                    <h3>Proposed values</h3>
                    <p>Recommendation: {request.proposed.recommend}</p>
                    <p>
                      Interactions:{' '}
                      {['met', 'host', 'guest']
                        .filter(key => request.proposed.interactions?.[key])
                        .join(', ')}
                    </p>
                    <p>
                      Feedback: {request.proposed.feedbackPublic || '(none)'}
                    </p>
                  </div>
                )}
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={busy}
                  onClick={() => decide(request, 'approve')}
                >
                  Approve
                </button>{' '}
                <button
                  className="btn btn-default"
                  type="button"
                  disabled={busy}
                  onClick={() => decide(request, 'reject')}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
