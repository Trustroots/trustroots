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
  onContactRemoved?: (contact: ContactRecord) => void;
}
type Source<T> =
  | { status: 'loading' | 'error' | 'unavailable' }
  | { status: 'ready'; data: T };

/** Each source can be retried independently; unmounted/past-pair reads are ignored. */
function useSource<T>(load: () => Promise<T>, enabled: boolean) {
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
  }, [attempt, enabled]);
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
      experiencesEnabled={referencesEnabled}
      feedbackEnabled={referencesEnabled}
      onContactRemoved={onContactRemoved}
    />
  );
}

function ConnectionPair({
  viewer,
  member,
  experiencesEnabled,
  feedbackEnabled,
  onContactRemoved,
}: Props & { experiencesEnabled: boolean; feedbackEnabled: boolean }) {
  const { t } = useTranslation('contacts');
  const { t: te } = useTranslation('experiences');
  const contact = useSource<ContactRecord | null>(
    () => contacts.getByUserId(member._id),
    true,
  );
  const experience = useSource<ExperienceMine | null>(
    () => experiences.readMine({ userWith: member._id }),
    experiencesEnabled,
  );
  const reference = useSource(() => loadFeedback(member._id), feedbackEnabled);
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
      setShowRemove(false);
      contact.retry();
    } catch (error) {
      if ([403, 404].includes(readApiError(error).status || 0)) {
        setMutationsAllowed(false);
      }
      setShowRemove(false);
      setRemoveError(true);
      contact.retry();
    } finally {
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
    if (!account) return <p>{t<string>('No account shared yet.')}</p>;
    const met = account.interactions?.met;
    return (
      <>
        <p>
          {yours
            ? viewer.displayName || viewer.username
            : member.displayName || member.username}
        </p>
        {typeof account.public === 'boolean' && (
          <p>
            {account.public
              ? t<string>('Public')
              : t<string>('Awaiting publication')}
          </p>
        )}
        {yours && account.public === false && (
          <p>
            {te<string>(
              'Your experience will become public when {{name}} shares their experience, or at most in {{count}} days.',
              {
                name: member.displayName || member.username,
                count: DAYS_TO_REPLY,
              },
            )}
          </p>
        )}
        <p>
          {t<string>('Met in person')}:{' '}
          {met === undefined
            ? t<string>('Not recorded')
            : met
              ? t<string>('Yes')
              : t<string>('No')}
        </p>
        {account.interactions?.host === true && (
          <p>
            {yours
              ? t<string>('You hosted this member')
              : t<string>('This member hosted you')}
          </p>
        )}
        {account.interactions?.guest === true && (
          <p>
            {yours
              ? t<string>('This member hosted you')
              : t<string>('You hosted this member')}
          </p>
        )}
        {account.recommend !== undefined && (
          <p>
            {t<string>('Recommendation')}:{' '}
            {account.recommend === 'yes'
              ? t<string>('Yes')
              : account.recommend === 'no'
                ? t<string>('No')
                : t<string>('Not recorded')}
          </p>
        )}
        {account.feedbackPublic !== undefined && (
          <p style={{ whiteSpace: 'pre-wrap' }}>{account.feedbackPublic}</p>
        )}
      </>
    );
  }
  const connection = contactState(record, viewer._id);
  return (
    <section
      aria-label={t<string>('Your connection')}
      className="panel panel-default"
    >
      <div className="panel-body">
        <h2>{t<string>('Your connection')}</h2>
        <p>
          {t<string>(
            'This section is private to you. It may include already-public Experiences.',
          )}
        </p>
        <section aria-label={t<string>('Connection')}>
          <h3>{t<string>('Connection')}</h3>
          {sourceStatus(contact.state, contact.retry)}
          {contact.state.status === 'ready' && (
            <>
              <p>
                {connection === 'absent'
                  ? t<string>('No contact')
                  : connection === 'incoming'
                    ? t<string>('Incoming contact request')
                    : connection === 'outgoing'
                      ? t<string>('Outgoing contact request')
                      : t<string>('Confirmed contact')}
              </p>
              {canConnect && (
                <>
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
                </>
              )}
            </>
          )}
          {removeError && (
            <p role="alert">
              {t<string>('Could not save your change. Please try again.')}
            </p>
          )}
        </section>
        <section aria-label={t<string>('Your account')}>
          <h3>{t<string>('Your account')}</h3>
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
        <section aria-label={t<string>('Their account')}>
          <h3>{t<string>('Their account')}</h3>
          {sourceStatus(experience.state, experience.retry)}
          {experience.state.status === 'ready' &&
            accountDetails(accounts.theirs, false)}
        </section>
        <section aria-label={t<string>('Private message feedback')}>
          <h3>{t<string>('Private message feedback')}</h3>
          {sourceStatus(reference.state, reference.retry)}
          {reference.state.status === 'ready' && (
            <>
              <p>
                {t<string>(
                  'Do you find messages from this person to be polite, respectful and in the spirit of Trustroots?',
                )}
              </p>
              <p>{t<string>("Your response won't be visible to them.")}</p>
              <p>
                {reference.state.data.answer
                  ? reference.state.data.answer.reference === 'yes'
                    ? t<string>('Yes')
                    : t<string>('No')
                  : t<string>('Not recorded')}
              </p>
              {canConnect &&
                reference.state.data.eligible &&
                feedbackAllowed && (
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
                  {canConnect &&
                    reference.state.data.eligible &&
                    feedbackAllowed && (
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
      </div>
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
