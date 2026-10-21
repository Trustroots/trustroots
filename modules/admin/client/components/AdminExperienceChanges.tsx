import React, { useEffect, useState } from 'react';

import * as api from '../api/admin-experience-changes.api';
import type {
  AdminExperienceChangeDecision,
  AdminExperienceChangeQueuedExperience,
  AdminExperienceChangeParticipant,
  AdminExperienceChangeRequest,
  AdminExperienceChangeSearchExperience,
} from '../../shared/admin-experience-change';
import AdminHeader from './AdminHeader.component';
import { Button } from '@trustroots/ui';

function memberLabel(member: AdminExperienceChangeParticipant): string {
  if (typeof member === 'object' && member !== null) {
    return member.displayName || member.username || 'Unknown member';
  }
  return 'Unknown member';
}

function MemberName({
  member,
}: {
  member: AdminExperienceChangeParticipant;
}): React.JSX.Element {
  const label = memberLabel(member);
  if (typeof member !== 'object' || member === null || !member.username)
    return <strong>{label}</strong>;
  return (
    <strong>
      <a href={`/profile/${member.username}/experiences`}>{label}</a>
    </strong>
  );
}

interface ExperienceDetailsProps {
  experience:
    | AdminExperienceChangeQueuedExperience
    | AdminExperienceChangeSearchExperience
    | null;
}

function ExperienceDetails({
  experience,
}: ExperienceDetailsProps): React.JSX.Element {
  if (!experience) return <p>Experience no longer available.</p>;
  return (
    <div>
      <p>
        <MemberName member={experience.userFrom} /> wrote about{' '}
        <MemberName member={experience.userTo} />
        {experience.public ? ' (public)' : ' (not yet public)'}.
      </p>
      <p>Recommendation: {experience.recommend}</p>
      <p>
        Interactions:{' '}
        {(['met', 'host', 'guest'] as const)
          .filter(key => experience.interactions?.[key])
          .join(', ')}
      </p>
      <p>Feedback: {experience.feedbackPublic || '(none)'}</p>
    </div>
  );
}

export default function AdminExperienceChanges(): React.JSX.Element {
  const [username, setUsername] = useState('');
  const [experiences, setExperiences] = useState<
    AdminExperienceChangeSearchExperience[]
  >([]);
  const [requests, setRequests] = useState<AdminExperienceChangeRequest[]>([]);
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function refreshRequests(): Promise<void> {
    setRequests(await api.listRequests());
  }

  useEffect(() => {
    refreshRequests().catch(() => setError('Could not load change requests.'));
  }, []);

  async function search(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setError('');
    try {
      setExperiences(await api.findExperiences(username));
    } catch {
      setError('Could not find Experiences for this member.');
    }
  }

  async function createLink(
    experience: AdminExperienceChangeSearchExperience,
    member: AdminExperienceChangeSearchExperience['userFrom'],
  ): Promise<void> {
    setError('');
    setBusy(true);
    try {
      if (!member) throw new Error('Member is unavailable.');
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

  async function decide(
    request: AdminExperienceChangeRequest,
    decision: AdminExperienceChangeDecision,
  ): Promise<void> {
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
          <form className="form-inline" onSubmit={event => void search(event)}>
            <label htmlFor="experience-member-username">Member username</label>{' '}
            <input
              className="form-control"
              id="experience-member-username"
              value={username}
              onChange={event => setUsername(event.target.value)}
            />{' '}
            <Button variant="default" type="submit">
              Find Experiences
            </Button>
          </form>
          {experiences.map(experience => (
            <div className="panel panel-default" key={experience._id}>
              <div className="panel-body">
                <ExperienceDetails experience={experience} />
                {experience.canIssue === false && (
                  <p>
                    Support members cannot change Experiences on their own
                    profile.
                  </p>
                )}
                <Button
                  variant="default"
                  type="button"
                  disabled={busy || experience.canIssue === false}
                  onClick={() =>
                    void createLink(experience, experience.userFrom)
                  }
                >
                  Copy link for author
                </Button>{' '}
                <Button
                  variant="default"
                  type="button"
                  disabled={busy || experience.canIssue === false}
                  onClick={() => void createLink(experience, experience.userTo)}
                >
                  Copy link for profile owner
                </Button>
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
          {requests.filter(request => request.status !== 'approved').length ===
            0 && <p>No requests awaiting review.</p>}
          {requests
            .filter(request => request.status !== 'approved')
            .map(request => (
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
                        {(['met', 'host', 'guest'] as const)
                          .filter(key => request.proposed.interactions[key])
                          .join(', ')}
                      </p>
                      <p>
                        Feedback: {request.proposed.feedbackPublic || '(none)'}
                      </p>
                    </div>
                  )}
                  {request.canReview === false ? (
                    <p>
                      Support members cannot change Experiences on their own
                      profile.
                    </p>
                  ) : (
                    request.canApprove === false && (
                      <p>
                        Approval requires another support team member or an
                        administrator.
                      </p>
                    )
                  )}
                  <Button
                    variant="primary"
                    type="button"
                    disabled={busy || request.canApprove === false}
                    onClick={() => void decide(request, 'approve')}
                  >
                    Approve
                  </Button>{' '}
                  <Button
                    variant="default"
                    type="button"
                    disabled={busy || request.canReview === false}
                    onClick={() => void decide(request, 'reject')}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))}
        </section>
        {requests.some(request => request.status === 'approved') && (
          <section>
            <h2>Recently approved</h2>
            <p>Approved edits stay here for seven days.</p>
            {requests
              .filter(request => request.status === 'approved')
              .map(request => (
                <div className="panel panel-default" key={request._id}>
                  <div className="panel-body">
                    <p>
                      <strong>Approved</strong>.{' '}
                      <strong>{memberLabel(request.requester)}</strong> edited
                      this Experience.
                    </p>
                    <ExperienceDetails experience={request.experience} />
                  </div>
                </div>
              ))}
          </section>
        )}
      </div>
    </>
  );
}
