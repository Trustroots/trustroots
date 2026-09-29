// External dependencies
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';

// Internal dependencies
import {
  getMessages,
  getScammerRecipients,
  sendScammerWarning,
} from '../api/messages.api';
import { searchUsers } from '../api/users.api';
import AdminHeader from './AdminHeader.component';
import AdminReferenceVoteItem from './AdminReferenceVoteItem.component';
import Json from './Json.component';
import UserLink from './UserLink.component';
import {
  MONGO_OBJECT_ID_LENGTH,
  resolveExactMemberId,
} from './userSearch.helpers';
import TimeAgo from '@/modules/core/client/components/TimeAgo';

interface AdminMessage {
  _id: string;
  userFrom: object;
  userTo: object;
  created: string | number | Date;
  read: boolean;
  content: string;
}

interface ReferenceThread {
  _id: string;
  [key: string]: unknown;
}

interface ScammerRecipient {
  _id: string;
  [key: string]: unknown;
}

interface ScammerRecipients {
  scammer: { username: string };
  recipients: ScammerRecipient[];
}

interface WarningAttempt {
  username: string;
  content: string;
  requestId: string;
}

interface MessagesResponse {
  messages: AdminMessage[];
  referenceThreads?: ReferenceThread[];
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = error.response as
      | { data?: { message?: string } }
      | undefined;
    return response?.data?.message || fallback;
  }
  return fallback;
}

export default function AdminMessages() {
  // @TODO: replace with useLocation of react-router or similar.
  const urlParams = new URLSearchParams(window.location.search);
  const urlUserId1 = urlParams.get('userId1');
  const urlUserId2 = urlParams.get('userId2');
  const initialMember1 = urlUserId1 || '';
  const initialMember2 = urlUserId2 || '';

  const [queried, setQueried] = useState(false);
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [referenceThreads, setReferenceThreads] = useState<ReferenceThread[]>(
    [],
  );
  const [member1, setMember1] = useState(initialMember1);
  const [member2, setMember2] = useState(initialMember2);
  const warningAttempt = useRef<WarningAttempt | null>(null);
  const [scammerUsername, setScammerUsername] = useState('');
  const [scammerRecipients, setScammerRecipients] =
    useState<ScammerRecipients | null>(null);
  const [scammerError, setScammerError] = useState('');
  const [warningContent, setWarningContent] = useState(
    'Sorry, you have received a message from a scammer. Please ignore it.',
  );
  const [warningSent, setWarningSent] = useState<number | null>(null);
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(false);
  const [isSendingWarning, setIsSendingWarning] = useState(false);

  const runQuery = useCallback(
    async (member1Value: string, member2Value: string) => {
      if (member1Value && member2Value) {
        const userId1 = await resolveExactMemberId(member1Value, searchUsers, [
          'username',
        ]);
        const userId2 = await resolveExactMemberId(member2Value, searchUsers, [
          'username',
        ]);
        if (!userId1 || !userId2) {
          setMessages([]);
          setReferenceThreads([]);
          setQueried(true);
          return;
        }

        const result: AdminMessage[] | MessagesResponse = await getMessages(
          userId1,
          userId2,
        );
        setMessages(Array.isArray(result) ? result : result.messages || []);
        setReferenceThreads(
          Array.isArray(result) ? [] : result.referenceThreads || [],
        );
        setQueried(true);
      }
    },
    [],
  );

  useEffect(() => {
    if (initialMember1 && initialMember2) {
      void runQuery(initialMember1, initialMember2);
    }
  }, [initialMember1, initialMember2, runQuery]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runQuery(member1, member2);
  }

  async function previewScammerRecipients(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const username = scammerUsername.trim();
    setScammerError('');
    setWarningSent(null);
    setIsLoadingRecipients(true);
    try {
      setScammerRecipients(await getScammerRecipients(username));
    } catch (error) {
      setScammerRecipients(null);
      setScammerError(getErrorMessage(error, 'Could not find that member.'));
    } finally {
      setIsLoadingRecipients(false);
    }
  }

  async function sendWarning(
    event: FormEvent<HTMLFormElement>,
    recipients: ScammerRecipients,
  ) {
    event.preventDefault();
    setScammerError('');
    setWarningSent(null);
    setIsSendingWarning(true);
    const username = recipients.scammer.username;
    if (
      !warningAttempt.current ||
      warningAttempt.current.username !== username ||
      warningAttempt.current.content !== warningContent
    ) {
      warningAttempt.current = {
        username,
        content: warningContent,
        requestId: Array.from(
          window.crypto.getRandomValues(new Uint8Array(16)),
          byte => byte.toString(16).padStart(2, '0'),
        ).join(''),
      };
    }
    const attempt = warningAttempt.current;
    try {
      const result = await sendScammerWarning(
        recipients.scammer.username,
        warningContent,
        attempt.requestId,
      );
      warningAttempt.current = null;
      setWarningSent(result.sent);
      setScammerRecipients(null);
    } catch (error) {
      setScammerError(getErrorMessage(error, 'Could not send the warning.'));
    } finally {
      setIsSendingWarning(false);
    }
  }

  return (
    <>
      <AdminHeader />
      <div className="container">
        <h2>Messages</h2>

        <section className="panel panel-warning">
          <div className="panel-heading">
            <h3 className="panel-title">Warn scammer recipients</h3>
          </div>
          <div className="panel-body">
            <p>Enter a member username to find everyone they contacted.</p>
            <form className="form-inline" onSubmit={previewScammerRecipients}>
              <input
                aria-label="Scammer username"
                className="form-control"
                disabled={isLoadingRecipients || isSendingWarning}
                onChange={({ target: { value } }) => {
                  setScammerUsername(value);
                  setScammerRecipients(null);
                  setScammerError('');
                  setWarningSent(null);
                }}
                placeholder="Scammer username"
                type="text"
                value={scammerUsername}
              />{' '}
              <button
                className="btn btn-default"
                disabled={
                  !scammerUsername.trim() ||
                  isLoadingRecipients ||
                  isSendingWarning
                }
                type="submit"
              >
                {isLoadingRecipients ? 'Looking up…' : 'Show recipients'}
              </button>
            </form>
            {scammerRecipients && (
              <form onSubmit={event => sendWarning(event, scammerRecipients)}>
                <p>
                  <strong>{scammerRecipients.recipients.length}</strong>{' '}
                  recipient(s) found for @{scammerRecipients.scammer.username}.
                </p>
                {scammerRecipients.recipients.length > 0 && (
                  <ul>
                    {scammerRecipients.recipients.map(recipient => (
                      <li key={recipient._id}>
                        <UserLink user={recipient} />
                      </li>
                    ))}
                  </ul>
                )}
                {scammerRecipients.recipients.length > 0 && (
                  <>
                    <textarea
                      aria-label="Warning message"
                      disabled={isSendingWarning}
                      className="form-control"
                      onChange={({ target: { value } }) =>
                        setWarningContent(value)
                      }
                      rows={3}
                      value={warningContent}
                    />
                    <button
                      className="btn btn-warning"
                      disabled={!warningContent.trim() || isSendingWarning}
                      type="submit"
                    >
                      {isSendingWarning ? 'Sending…' : 'Send warning to all'}
                    </button>
                  </>
                )}
              </form>
            )}
            {warningSent !== null && (
              <p className="text-success">
                Sent {warningSent} warning message(s).
              </p>
            )}
            {scammerError && <p className="text-danger">{scammerError}</p>}
          </div>
        </section>

        <form className="form-inline" onSubmit={event => onSubmit(event)}>
          <input
            aria-label="Member 1 username or ID"
            className="form-control input-lg"
            name="member1"
            onChange={({ target: { value } }) => setMember1(value)}
            placeholder="Member 1 username or ID"
            size={MONGO_OBJECT_ID_LENGTH + 2}
            type="text"
            value={member1}
          />
          <input
            aria-label="Member 2 username or ID"
            className="form-control input-lg"
            name="member2"
            onChange={({ target: { value } }) => setMember2(value)}
            placeholder="Member 2 username or ID"
            size={MONGO_OBJECT_ID_LENGTH + 2}
            type="text"
            value={member2}
          />
          <button
            className="btn btn-lg btn-default"
            disabled={!member1.trim() || !member2.trim()}
            type="submit"
          >
            Read
          </button>
        </form>

        {!queried && messages.length === 0 && (
          <p>
            <em className="text-muted">
              {member1 && member2 ? 'Press "Read"' : 'Choose two members…'}
            </em>
          </p>
        )}

        {queried && messages.length > 0 && (
          <>
            <h3>
              Messaging between <UserLink user={messages[0].userFrom} />
              {' & '}
              <UserLink user={messages[0].userTo} />
            </h3>
            {referenceThreads.length > 0 && (
              <div className="alert alert-warning">
                <strong>Thread votes</strong>
                <ul>
                  {referenceThreads.map(referenceThread => (
                    <AdminReferenceVoteItem
                      key={referenceThread._id}
                      referenceThread={referenceThread}
                    />
                  ))}
                </ul>
              </div>
            )}
            {messages.map(message => {
              const { _id } = message;
              return (
                <div className="panel panel-default" key={_id}>
                  <div className="panel-body">
                    <UserLink user={message.userFrom} />
                    {' · '}
                    <TimeAgo date={new Date(message.created)} />
                    {' · '}
                    {message.read ? 'Seen.' : 'Not seen.'}
                    <br />
                    <br />
                    <div
                      dangerouslySetInnerHTML={{ __html: message.content }}
                    />
                    <br />
                    <details>
                      <summary>Database entry</summary>
                      <Json content={message} />
                    </details>
                  </div>
                </div>
              );
            })}
          </>
        )}
        {queried && messages.length === 0 && (
          <div className="alert alert-info">
            <em>Nothing found…</em>
          </div>
        )}
      </div>
    </>
  );
}

AdminMessages.propTypes = {};
