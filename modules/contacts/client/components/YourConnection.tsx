import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as contacts from '../api/contacts.api';
import * as experiences from '@/modules/experiences/client/api/experiences.api';
import * as feedback from '@/modules/references-thread/client/api/reference-thread.api';
import type { ContactRecord } from '../types';
import type { ExperienceMine } from '@/modules/experiences/shared/experience';
import {
  connectionAccounts,
  contactState,
  memberId,
  type ConnectionAccount,
} from '../utils/connection';
import { readApiError } from '@/modules/users/client/utils/api-error';
import { useSettings } from '@/modules/core/client/react-app/AppProviders';
import { getProfileExperiencesPath } from '@/modules/core/shared/navigation-links';
import { DAYS_TO_REPLY } from '@/modules/experiences/client/utils/constants';
import RemoveContact from './RemoveContact';

interface Member {
  _id: string;
  username?: string;
  displayName?: string;
  public?: boolean;
  roles?: string[];
  blocked?: string[];
}
interface Props {
  viewer: Member;
  member: Member;
  available?: boolean;
  contactRefreshKey?: string;
  onContactRemoved?: (contact: ContactRecord) => void;
}
type Source<T> =
  | { status: 'loading' | 'error' | 'unavailable' }
  | { status: 'ready'; data: T };

/** Each source can be retried independently; unmounted/past-pair reads are ignored. */
function useSource<T>(
  load: () => Promise<T>,
  enabled: boolean,
  refreshKey?: string,
) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<Source<T>>({
    status: enabled ? 'loading' : 'unavailable',
  });
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setState({ status: 'loading' });
    load().then(
      data => {
        if (active) setState({ status: 'ready', data });
      },
      () => {
        if (active) setState({ status: 'error' });
      },
    );
    return () => {
      active = false;
    };
  }, [attempt, enabled, refreshKey]);
  return { state, setState, retry: () => setAttempt(value => value + 1) };
}

async function loadFeedback(id: string) {
  try {
    const answer = await feedback.get(id);
    return { answer, eligible: Boolean(answer) };
  } catch (error) {
    const parsed = readApiError(error);
    if (
      parsed.status === 404 &&
      typeof parsed.data.allowCreatingReference === 'boolean'
    ) {
      return { answer: null, eligible: parsed.data.allowCreatingReference };
    }
    throw error;
  }
}

export default function YourConnection({
  viewer,
  member,
  available = true,
  contactRefreshKey,
  onContactRemoved,
}: Props) {
  const { referencesEnabled = false } = useSettings();
  const permitted =
    available &&
    viewer.public === true &&
    member.public !== false &&
    Boolean(member.username) &&
    viewer._id !== member._id &&
    ![viewer, member].some(person =>
      person.roles?.some(role => ['suspended', 'shadowban'].includes(role)),
    );
  if (!permitted) return null;
  return (
    <ConnectionPair
      key={`${viewer._id}:${member._id}:${referencesEnabled}:${viewer.blocked?.includes(member._id)}`}
      viewer={viewer}
      member={member}
      referencesEnabled={referencesEnabled}
      contactRefreshKey={contactRefreshKey}
      onContactRemoved={onContactRemoved}
    />
  );
}

function ConnectionPair({
  viewer,
  member,
  referencesEnabled,
  contactRefreshKey,
  onContactRemoved,
}: Props & { referencesEnabled: boolean }) {
  const { t } = useTranslation('contacts');
  const { t: te } = useTranslation('experiences');
  const contact = useSource<ContactRecord | null>(
    () => contacts.getByUserId(member._id),
    true,
    contactRefreshKey,
  );
  const experience = useSource<ExperienceMine | null>(
    () => experiences.readMine({ userWith: member._id }),
    referencesEnabled,
  );
  const reference = useSource(
    () => loadFeedback(member._id),
    referencesEnabled,
  );
  const [showRemove, setShowRemove] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mutationError, setMutationError] = useState(false);
  const [pendingAnswer, setPendingAnswer] = useState<'yes' | 'no' | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState(false);
  const [changing, setChanging] = useState(false);
  const [feedbackAllowed, setFeedbackAllowed] = useState(true);
  const [mutationsAllowed, setMutationsAllowed] = useState(true);
  const canConnect = mutationsAllowed && !viewer.blocked?.includes(member._id);
  const canAnswer =
    mutationsAllowed &&
    reference.state.status === 'ready' &&
    reference.state.data.eligible &&
    feedbackAllowed;
  const record = contact.state.status === 'ready' ? contact.state.data : null;
  const accounts =
    experience.state.status === 'ready'
      ? connectionAccounts(experience.state.data, viewer._id, member._id)
      : { yours: null, theirs: null };
  // Async writes may finish after navigation; state belongs only to this keyed pair.
  async function answer(value: 'yes' | 'no') {
    setSaving(true);
    setPendingAnswer(value);
    setMutationError(false);
    try {
      await feedback.send(value, member._id);
      reference.setState({
        status: 'ready',
        data: {
          answer: { reference: value, created: new Date() },
          eligible: true,
        },
      });
      setChanging(false);
      setPendingAnswer(null);
    } catch (error) {
      if ([403, 404].includes(readApiError(error).status || 0)) {
        setMutationsAllowed(false);
      }
      setMutationError(true);
      // Recheck server eligibility while retaining the last confirmed answer.
      try {
        setFeedbackAllowed((await loadFeedback(member._id)).eligible);
      } catch {
        /* The previous answer remains authoritative until refreshed. */
      }
    } finally {
      setSaving(false);
    }
  }
  async function removeContact(contactId: string) {
    setRemoving(true);
    setRemoveError(false);
    try {
      await contacts.remove(contactId);
      onContactRemoved?.(record!);
    } catch (error) {
      if ([403, 404].includes(readApiError(error).status || 0)) {
        setMutationsAllowed(false);
      }
      setRemoveError(true);
    } finally {
      setShowRemove(false);
      contact.retry();
      setRemoving(false);
    }
  }
  function sourceStatus(source: Source<unknown>, retry: () => void) {
    if (source.status === 'ready') return null;
    if (source.status === 'error')
      return (
        <p role="alert">
          {t<string>('Could not load this section.')}{' '}
          <button type="button" className="btn btn-link" onClick={retry}>
            {t<string>('Retry')}
          </button>
        </p>
      );
    return (
      <p>
        {source.status === 'loading'
          ? t<string>('Loading…')
          : t<string>('Unavailable')}
      </p>
    );
  }
  function accountDetails(account: ConnectionAccount | null, yours: boolean) {
    if (!account)
      return (
        <p className="text-muted">{t<string>('No Experience shared yet.')}</p>
      );
    const met = account.interactions?.met;
    return (
      <>
        <div className="your-connection-byline">
          <span>
            {t<string>('Written by {{name}}', {
              name: yours
                ? viewer.displayName || viewer.username
                : member.displayName || member.username,
            })}
          </span>
          {typeof account.public === 'boolean' && (
            <span className="your-connection-visibility">
              {account.public
                ? t<string>('Public')
                : t<string>('Awaiting publication')}
            </span>
          )}
        </div>
        {yours && account.public === false && (
          <p className="your-connection-note">
            {te<string>(
              'Your experience will become public when {{name}} shares their experience, or at most in {{count}} days.',
              {
                name: member.displayName || member.username,
                count: DAYS_TO_REPLY,
              },
            )}
          </p>
        )}
        <table
          className="your-connection-facts"
          aria-label={
            yours ? t<string>('Your Experience') : t<string>('Their Experience')
          }
        >
          <tbody>
            <tr>
              <th scope="row">{t<string>('Met in person')}</th>
              <td>
                {met === undefined
                  ? t<string>('Not recorded')
                  : met
                    ? t<string>('Yes')
                    : t<string>('No')}
              </td>
            </tr>
            {account.interactions?.host === true && (
              <tr>
                <th scope="row">{t<string>('Hosting')}</th>
                <td>
                  {yours
                    ? t<string>('You hosted this member')
                    : t<string>('This member hosted you')}
                </td>
              </tr>
            )}
            {account.interactions?.guest === true && (
              <tr>
                <th scope="row">{t<string>('Staying')}</th>
                <td>
                  {yours
                    ? t<string>('This member hosted you')
                    : t<string>('You hosted this member')}
                </td>
              </tr>
            )}
            {account.recommend !== undefined && (
              <tr>
                <th scope="row">{t<string>('Recommendation')}</th>
                <td>
                  {account.recommend === 'yes'
                    ? t<string>('Yes')
                    : account.recommend === 'no'
                      ? t<string>('No')
                      : t<string>('Not recorded')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {account.feedbackPublic !== undefined && (
          <blockquote className="your-connection-quote">
            {account.feedbackPublic}
          </blockquote>
        )}
      </>
    );
  }
  const connection = contactState(record, viewer._id);
  return (
    <section
      aria-label={t<string>('Your connection')}
      className="your-connection"
    >
      <header className="your-connection-header">
        <h2>{t<string>('Your connection')}</h2>
        <p className="your-connection-note">
          {t<string>(
            'Only you can see this panel. Published Experiences remain public.',
          )}
        </p>
      </header>
      <section
        aria-label={t<string>('Contact')}
        className="your-connection-contact"
      >
        <h3>{t<string>('Contact')}</h3>
        {sourceStatus(contact.state, contact.retry)}
        {contact.state.status === 'ready' && (
          <div className="your-connection-contact-status">
            <span>
              {connection === 'absent'
                ? t<string>('No contact')
                : connection === 'incoming'
                  ? t<string>('Incoming contact request')
                  : connection === 'outgoing'
                    ? t<string>('Outgoing contact request')
                    : t<string>('Confirmed contact')}
            </span>
            {canConnect && (
              <div className="your-connection-actions">
                {connection === 'absent' && (
                  <a href={`/contact-add/${member._id}`}>
                    {t<string>('Add contact')}
                  </a>
                )}
                {connection === 'incoming' && record?._id && (
                  <a href={`/contact-confirm/${record._id}`}>
                    {t<string>('Confirm contact')}
                  </a>
                )}
                {record?._id && (
                  <button
                    type="button"
                    className="btn btn-link"
                    onClick={() => setShowRemove(true)}
                  >
                    {connection === 'confirmed'
                      ? t<string>('Remove contact')
                      : connection === 'incoming'
                        ? t<string>('Decline request')
                        : t<string>('Cancel request')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        {removeError && (
          <p role="alert">
            {t<string>('Could not save your change. Please try again.')}
          </p>
        )}
      </section>
      <div className="your-connection-experiences">
        <section
          aria-label={t<string>('Your Experience')}
          className="your-connection-experience"
        >
          <h3>{t<string>('Your Experience')}</h3>
          {sourceStatus(experience.state, experience.retry)}
          {experience.state.status === 'ready' && (
            <>
              {accountDetails(accounts.yours, true)}
              <a
                href={
                  accounts.yours
                    ? `/profile/${member.username}/experiences`
                    : getProfileExperiencesPath(member.username!)
                }
              >
                {accounts.yours
                  ? t<string>('View Experiences')
                  : t<string>('Share your experience')}
              </a>
            </>
          )}
        </section>
        <section
          aria-label={t<string>('Their Experience')}
          className="your-connection-experience"
        >
          <h3>{t<string>('Their Experience')}</h3>
          {sourceStatus(experience.state, experience.retry)}
          {experience.state.status === 'ready' &&
            accountDetails(accounts.theirs, false)}
        </section>
      </div>
      <section
        aria-label={t<string>('Private message feedback')}
        className="your-connection-feedback"
      >
        <h3>{t<string>('Private message feedback')}</h3>
        {sourceStatus(reference.state, reference.retry)}
        {reference.state.status === 'ready' && (
          <>
            <p>
              {t<string>(
                'Do you find messages from this person to be polite, respectful and in the spirit of Trustroots?',
              )}
            </p>
            <p className="your-connection-note">
              {t<string>("Your response won't be visible to them.")}
            </p>
            <p>
              {reference.state.data.answer
                ? reference.state.data.answer.reference === 'yes'
                  ? t<string>('Yes')
                  : t<string>('No')
                : t<string>('Not recorded')}
            </p>
            {canAnswer && (
              <>
                {reference.state.data.answer && !changing ? (
                  <button
                    type="button"
                    className="btn btn-link"
                    onClick={() => setChanging(true)}
                  >
                    {t<string>('Change')}
                  </button>
                ) : (
                  <div role="group" aria-label={t<string>('Your answer')}>
                    <button
                      type="button"
                      disabled={saving}
                      className="btn btn-default"
                      onClick={() => void answer('yes')}
                    >
                      {t<string>('Yes')}
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      className="btn btn-default"
                      onClick={() => void answer('no')}
                    >
                      {t<string>('No')}
                    </button>
                  </div>
                )}
              </>
            )}
            {mutationError && (
              <p role="alert">
                {t<string>('Could not save your change. Please try again.')}{' '}
                {canAnswer && (
                  <button
                    type="button"
                    className="btn btn-link"
                    disabled={saving}
                    onClick={() => void answer(pendingAnswer!)}
                  >
                    {t<string>('Retry')}
                  </button>
                )}
              </p>
            )}
          </>
        )}
      </section>
      {record?._id && showRemove && (
        <RemoveContact
          contact={{ ...record, userFrom: memberId(record.userFrom) }}
          selfId={viewer._id}
          show
          inProgress={removing}
          onRemove={() => void removeContact(record._id!)}
          onCancel={() => setShowRemove(false)}
        />
      )}
    </section>
  );
}
