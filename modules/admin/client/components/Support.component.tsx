import React, { useEffect, useState } from 'react';
import { plainText } from '../../../core/client/utils/filters';
import AdminHeader from './AdminHeader.component';
import AdminNotes from './AdminNotes';
import SupportStatusImport from './SupportStatusImport';
import UserState from './UserState.component';
import { SUPPORT_CATEGORIES } from '../../../support/shared/categories';
import {
  SUPPORT_STATUSES,
  SUPPORT_STATUS_LABELS,
  normaliseSupportStatus,
  type SupportStatus,
} from '../../../support/shared/statuses';
import * as api from '../api/support.api';
import { formatAdminDateTime } from '../utils/admin-date';
import { useAuth } from '../../../core/client/react-app/auth';
import type {
  InvestigationItem,
  Page,
  SupportMember,
  SupportConversationItem,
  SupportQueueResponse,
  SupportRequest,
} from '../api/support.api';
import { Button } from '@trustroots/ui/Button';

const DEFAULT_STATUS = 'unresolved';
const SEARCH_LIMIT = 200;

type InboxLocation = {
  status: string;
  category: string;
  page: number;
  q: string;
  requestId: string | null;
};

function MemberUsername({
  username,
  fallback,
}: {
  username?: string;
  fallback: string;
}) {
  return username ? (
    <a href={`/admin/user/${encodeURIComponent(username)}`}>{username}</a>
  ) : (
    <>{fallback}</>
  );
}

function readInboxLocation(): InboxLocation {
  const params = new URLSearchParams(window.location.search);
  const rawStatus = params.get('status') || DEFAULT_STATUS;
  const status = rawStatus === 'resolved' ? 'solved' : rawStatus;
  const pageValue = Number(params.get('page') || '1');
  const requestMatch = window.location.pathname.match(
    /^\/admin\/support\/requests\/([^/]+)\/?$/,
  );
  let requestId: string | null = null;
  if (requestMatch) {
    try {
      requestId = decodeURIComponent(requestMatch[1]);
    } catch {
      // Keep malformed URL text inert; ids are validated by the API.
      requestId = requestMatch[1];
    }
  }
  return {
    status:
      status === 'all' ||
      status === 'unconfirmed' ||
      status === DEFAULT_STATUS ||
      SUPPORT_STATUSES.includes(status as SupportStatus)
        ? status
        : DEFAULT_STATUS,
    category: params.get('category') || '',
    page: Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1,
    q: (params.get('q') || '').slice(0, SEARCH_LIMIT),
    requestId,
  };
}

function writeInboxLocation(value: InboxLocation, replace: boolean): void {
  const params = new URLSearchParams();
  if (value.status !== DEFAULT_STATUS) params.set('status', value.status);
  if (value.category) params.set('category', value.category);
  if (value.page > 1) params.set('page', String(value.page));
  if (value.q) params.set('q', value.q);
  const pathname = value.requestId
    ? `/admin/support/requests/${encodeURIComponent(value.requestId)}`
    : '/admin/support';
  const query = params.toString();
  const url = `${pathname}${query ? `?${query}` : ''}`;
  if (replace) window.history.replaceState(window.history.state, '', url);
  else window.history.pushState(window.history.state, '', url);
  // Let TanStack Router and this component observe history API navigation.
  window.dispatchEvent(
    new PopStateEvent('popstate', { state: window.history.state }),
  );
}

function newIdempotencyKey(): string {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function deliveryLabel(
  state: SupportConversationItem['deliveryState'],
): string {
  const labels: Record<SupportConversationItem['deliveryState'], string> = {
    received: 'Received',
    queued: 'Queued',
    sending: 'Sending',
    accepted: 'Accepted by mail server',
    captured: 'Captured for testing (not sent)',
    failed: 'Delivery failed',
    uncertain: 'Delivery uncertain',
  };
  return labels[state];
}

function chronological(items: SupportConversationItem[]) {
  return [...items].sort(
    (left, right) =>
      (Date.parse(left.createdAt) || 0) - (Date.parse(right.createdAt) || 0),
  );
}

function splitQuotedCorrespondence(body: string) {
  const lines = body.split('\n');
  const quoteStart = lines.findIndex(
    (line, index) =>
      /^\s*>/.test(line) ||
      (index > 0 &&
        /^\s*(?:on .+wrote:|from:\s.+|[-_]{5,}\s*(?:original|forwarded) message\s*[-_]{0,})\s*$/i.test(
          line,
        )),
  );
  if (quoteStart < 0) return { current: body, quoted: '' };
  return {
    current: lines.slice(0, quoteStart).join('\n'),
    quoted: lines.slice(quoteStart).join('\n'),
  };
}

function decodeSupportText(text: string): string {
  // Decode entity tokens only, then let React render the result as text.
  // Raw markup never enters an HTML parser or the rendered DOM.
  return text.replace(
    /&(?:#(?:x[\da-f]{1,8}|\d{1,10})|[a-z][a-z\d]{1,31});/gi,
    entity => plainText(entity),
  );
}

function ConversationBody({ body }: { body: string }) {
  const { current, quoted } = splitQuotedCorrespondence(
    decodeSupportText(body),
  );
  return (
    <>
      {current && <div className="support-inbox__message-body">{current}</div>}
      {quoted ? (
        <details className="support-inbox__quoted-message">
          <summary>Show quoted correspondence</summary>
          <div className="support-inbox__message-body">{quoted}</div>
        </details>
      ) : (
        !current && (
          <div className="support-inbox__message-body">
            {decodeSupportText(body)}
          </div>
        )
      )}
    </>
  );
}

function Conversation({
  id,
  requester,
  requesterUsername,
  onChange,
}: {
  id: string;
  requester: string;
  requesterUsername?: string;
  onChange: () => void;
}) {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<SupportConversationItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [draft, setDraft] = useState('');
  const [lastAttempt, setLastAttempt] = useState<{
    body: string;
    idempotencyKey: string;
  } | null>(null);
  const [sending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [retryFailed, setRetryFailed] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    api
      .loadConversation(id, page)
      .then(result => {
        if (active) {
          setItems(chronological(result.items));
          setHasMore(result.hasMore);
        }
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, page, revision]);

  async function submitReply(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setSendFailed(false);
    const idempotencyKey =
      lastAttempt?.body === body
        ? lastAttempt.idempotencyKey
        : newIdempotencyKey();
    setLastAttempt({ body, idempotencyKey });
    try {
      const message = await api.sendReply(id, body, idempotencyKey);
      setItems(current =>
        chronological(
          current.some(item => item._id === message._id)
            ? current.map(item => (item._id === message._id ? message : item))
            : [...current, message],
        ),
      );
      setDraft('');
      setLastAttempt(null);
      onChange();
    } catch {
      setSendFailed(true);
    } finally {
      setSending(false);
    }
  }

  async function retry(item: SupportConversationItem) {
    const confirmUncertain = item.deliveryState === 'uncertain';
    if (
      confirmUncertain &&
      !window.confirm(
        'Delivery may already have succeeded. Retry this message anyway?',
      )
    ) {
      return;
    }
    setRetrying(item._id);
    setRetryFailed(null);
    try {
      const updated = await api.retryReply(
        id,
        item._id,
        newIdempotencyKey(),
        confirmUncertain,
      );
      setItems(current =>
        current.map(message => (message._id === item._id ? updated : message)),
      );
      onChange();
    } catch {
      setRetryFailed(item._id);
    } finally {
      setRetrying(null);
    }
  }

  return (
    <section
      className="support-inbox__conversation"
      aria-label="Support conversation"
    >
      <header className="support-inbox__conversation-header">
        <div>
          <h3>Conversation</h3>
          <p>Replies are shared with the support team.</p>
        </div>
        <Button
          type="button"
          disabled={loading}
          onClick={() => {
            setRevision(value => value + 1);
            onChange();
          }}
        >
          Refresh conversation
        </Button>
        <p className="support-inbox__attachment-note">
          Attachments remain in Zoho. Files cannot be uploaded here.
        </p>
      </header>
      {loading && <p role="status">Loading conversation…</p>}
      {failed && (
        <div role="alert">
          <p>Unable to load the conversation. Please try again.</p>
          <Button onClick={() => setRevision(v => v + 1)}>Retry</Button>
        </div>
      )}
      {!loading && !failed && items.length === 0 && <p>No messages yet.</p>}
      <ol className="support-inbox__messages" aria-live="polite">
        {items.map(item => {
          const author =
            item.direction === 'outbound'
              ? item.authorName || 'Support team'
              : requester;
          return (
            <li key={item._id}>
              <article
                className="support-inbox__message-item"
                data-direction={item.direction}
                aria-label={`${author}, ${formatAdminDateTime(item.createdAt)}`}
              >
                <header>
                  <strong>
                    {item.direction === 'inbound' &&
                    item.kind === 'initial' &&
                    requesterUsername ? (
                      <a
                        href={`/admin/user/${encodeURIComponent(requesterUsername)}`}
                      >
                        {requesterUsername}
                      </a>
                    ) : (
                      author
                    )}
                  </strong>
                  <time dateTime={item.createdAt}>
                    {formatAdminDateTime(item.createdAt)}
                  </time>
                </header>
                <ConversationBody body={item.body} />
                {item.attachments?.length ? (
                  <div className="support-inbox__attachments">
                    <strong>Attachment notice</strong>
                    <ul>
                      {item.attachments.map((attachment, index) => (
                        <li key={`${attachment.filename || 'file'}-${index}`}>
                          {attachment.filename || 'File'}
                          {attachment.size !== undefined &&
                            ` (${Math.ceil(attachment.size / 1024)} KB)`}
                        </li>
                      ))}
                    </ul>
                    <p>Original files remain in Zoho.</p>
                  </div>
                ) : null}
                {(item.oversized || item.truncated) && (
                  <p className="support-inbox__truncation-note">
                    {item.oversized
                      ? 'This email exceeded the processing limit. Its content is omitted here. Read the complete email in Zoho.'
                      : 'This email was truncated to fit local storage. Read the complete email in Zoho.'}
                  </p>
                )}
                {item.direction === 'outbound' && (
                  <footer>
                    <span
                      className="support-inbox__delivery"
                      data-delivery={item.deliveryState}
                    >
                      {deliveryLabel(item.deliveryState)}
                    </span>
                    {item.kind === 'reply' &&
                      (item.deliveryState === 'failed' ||
                        item.deliveryState === 'uncertain') && (
                        <Button
                          variant="link"
                          disabled={retrying === item._id}
                          onClick={() => void retry(item)}
                        >
                          {retrying === item._id
                            ? 'Retrying…'
                            : 'Retry delivery'}
                        </Button>
                      )}
                    {retryFailed === item._id && (
                      <span role="alert">Retry could not be queued.</span>
                    )}
                  </footer>
                )}
              </article>
            </li>
          );
        })}
      </ol>
      {hasMore && (
        <div className="support-inbox__conversation-pager">
          <Button
            disabled={page === 1 || loading}
            onClick={() => setPage(value => value - 1)}
          >
            Previous messages
          </Button>
          <Button
            disabled={loading}
            onClick={() => setPage(value => value + 1)}
          >
            Next messages
          </Button>
        </div>
      )}
      <form className="support-inbox__composer" onSubmit={submitReply}>
        <label htmlFor="support-reply">Reply to requester</label>
        <textarea
          className="form-control"
          id="support-reply"
          maxLength={20000}
          rows={5}
          value={draft}
          onChange={event => setDraft(event.target.value)}
        />
        <p className="support-inbox__composer-note">
          Plain text only. Do not include sensitive details that should not be
          emailed.
        </p>
        {sendFailed && (
          <p role="alert">
            Reply could not be queued. Your draft is still here; you can try
            again.
          </p>
        )}
        <Button
          colour="primary"
          type="submit"
          disabled={sending || !draft.trim()}
        >
          {sending ? 'Sending…' : 'Send reply'}
        </Button>
      </form>
    </section>
  );
}

function useResource<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setData(null);
    setFailed(false);
    api
      .load<T>(path)
      .then(value => {
        if (active) setData(value);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [path, revision]);
  return { data, failed, reload: () => setRevision(value => value + 1) };
}

function ResourceState({ failed }: { failed: boolean }) {
  return (
    <p role={failed ? 'alert' : 'status'}>
      {failed
        ? 'Unable to load support information. Please try again.'
        : 'Loading…'}
    </p>
  );
}

function Pager({
  page,
  hasMore,
  onPage,
}: {
  page: number;
  hasMore: boolean;
  onPage: (page: number) => void;
}) {
  return (
    <div className="support-inbox__pager" aria-label="Pagination">
      <Button disabled={page === 1} onClick={() => onPage(page - 1)}>
        Previous
      </Button>
      <Button disabled={!hasMore} onClick={() => onPage(page + 1)}>
        Next
      </Button>
    </div>
  );
}

function Investigation({
  id,
  kind,
}: {
  id: string;
  kind: 'messages' | 'experiences';
}) {
  const [page, setPage] = useState(1);
  const { data, failed, reload } = useResource<Page<InvestigationItem>>(
    `/api/admin/support/${id}/${kind}?page=${page}`,
  );
  return (
    <section
      className="support-inbox__investigation"
      aria-label={
        kind === 'messages' ? 'Reported conversation' : 'Reported experiences'
      }
    >
      <h3>
        {kind === 'messages'
          ? 'Entire conversation'
          : 'All experiences between these members'}
      </h3>
      {!data ? (
        <>
          <ResourceState failed={failed} />
          {failed && <button onClick={reload}>Retry</button>}
        </>
      ) : (
        <>
          {data.items.length === 0 && <p>No {kind} found.</p>}
          {data.items.map(item => (
            <article className="panel panel-default" key={item._id}>
              <div className="panel-body">
                <p>
                  <strong>
                    <MemberUsername
                      username={item.userFrom?.username}
                      fallback="Deleted member"
                    />
                  </strong>{' '}
                  →{' '}
                  <MemberUsername
                    username={item.userTo?.username}
                    fallback="Deleted member"
                  />{' '}
                  ·{' '}
                  <time dateTime={item.created}>
                    {formatAdminDateTime(item.created)}
                  </time>
                </p>
                {item.shadowHidden && <p>Hidden message</p>}
                {kind === 'experiences' && (
                  <p>
                    {item.public ? 'Published' : 'Unpublished'} ·
                    Recommendation: {item.recommend}
                  </p>
                )}
                <div
                  style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                >
                  {plainText(
                    kind === 'messages' ? item.content : item.feedbackPublic,
                  )}
                </div>
              </div>
            </article>
          ))}
          <Pager page={page} hasMore={data.hasMore} onPage={setPage} />
        </>
      )}
    </section>
  );
}

function CaseMemberStatus({
  id,
  label,
  linkLabel,
}: {
  id: string;
  label: string;
  linkLabel: string;
}) {
  const {
    data: member,
    failed,
    reload,
  } = useResource<SupportMember>(
    `/api/admin/support-members/${encodeURIComponent(id)}`,
  );
  return (
    <div role="group" aria-label={label}>
      {member ? (
        <>
          <UserState user={member} />
          {member.pendingDeletion && <p>Pending deletion</p>}
        </>
      ) : failed ? (
        <p>
          Account status unavailable.{' '}
          <Button variant="link" onClick={reload}>
            Retry
          </Button>
        </p>
      ) : (
        <p role="status">Loading account status…</p>
      )}
      <a
        href={`/admin/support/member/${encodeURIComponent(member?.username || id)}`}
      >
        {linkLabel}
      </a>
    </div>
  );
}

function RequestDetails({
  id,
  onChange,
}: {
  id: string;
  onChange: () => void;
}) {
  const {
    data: report,
    failed,
    reload,
  } = useResource<SupportRequest>(`/api/admin/support/${id}`);
  const [kind, setKind] = useState<'messages' | 'experiences' | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  if (!report) return <ResourceState failed={failed} />;
  const status = normaliseSupportStatus(report.status);

  async function toggleStatus() {
    const nextStatus: SupportStatus = status === 'solved' ? 'open' : 'solved';
    await changeStatus(nextStatus);
  }
  async function changeStatus(status: SupportStatus) {
    setSaving(true);
    setSaveFailed(false);
    try {
      await api.setStatus(id, status);
      reload();
      onChange();
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  }
  const linked =
    report.category === 'reportMember' && report.user && report.reportedUser;
  return (
    <section
      className="support-inbox__card support-inbox__request"
      aria-label="Support request"
    >
      <header className="support-inbox__request-header">
        <div>
          <p className="support-inbox__eyebrow">Selected request</p>
          <h2>
            {
              SUPPORT_CATEGORIES[
                report.category as keyof typeof SUPPORT_CATEGORIES
              ]
            }
          </h2>
          {report.subject && (
            <p className="support-inbox__subject">
              {decodeSupportText(report.subject)}
            </p>
          )}
        </div>
        <span className="support-inbox__status" data-status={status}>
          {report.statusProvenance === 'missing'
            ? 'Unconfirmed legacy status'
            : SUPPORT_STATUS_LABELS[status]}
        </span>
      </header>
      <dl className="support-inbox__metadata">
        <div>
          <dt>From</dt>
          <dd>
            <MemberUsername
              username={report.username}
              fallback="Signed-out visitor"
            />
          </dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{report.email}</dd>
        </div>
        <div>
          <dt>Received</dt>
          <dd>
            <time dateTime={report.sent}>
              {formatAdminDateTime(report.sent)}
            </time>
          </dd>
        </div>
        {report.lastActivityAt && (
          <div>
            <dt>Last activity</dt>
            <dd>
              <time dateTime={report.lastActivityAt}>
                {formatAdminDateTime(report.lastActivityAt)}
              </time>
            </dd>
          </div>
        )}
      </dl>
      <div className="support-inbox__actions">
        <label htmlFor="support-request-status">Status</label>
        <select
          className="form-control support-inbox__status-select"
          id="support-request-status"
          value={status}
          disabled={saving}
          onChange={event =>
            void changeStatus(event.target.value as SupportStatus)
          }
        >
          {SUPPORT_STATUSES.map(value => (
            <option key={value} value={value}>
              {SUPPORT_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
        <Button colour="primary" disabled={saving} onClick={toggleStatus}>
          {status === 'solved' ? 'Reopen request' : 'Mark solved'}
        </Button>
      </div>
      {saveFailed && (
        <p role="alert">Unable to update this request. Please try again.</p>
      )}
      <div className="support-inbox__members">
        <div>
          <h3>Reporter</h3>
          <p>
            <MemberUsername
              username={report.username}
              fallback="Signed-out visitor"
            />
          </p>
          {report.user && (
            <>
              <CaseMemberStatus
                id={report.user}
                label="Reporter account status"
                linkLabel="Reporter account and notes"
              />
            </>
          )}
        </div>
        {(report.reportMember || report.reportedUser) && (
          <div>
            <h3>Reported member</h3>
            {report.reportMember && (
              <p>
                <MemberUsername
                  username={report.reportMember}
                  fallback="Deleted member"
                />
              </p>
            )}
            {report.reportedUser && (
              <>
                <CaseMemberStatus
                  id={report.reportedUser}
                  label="Reported member account status"
                  linkLabel="Reported account and notes"
                />
              </>
            )}
          </div>
        )}
      </div>
      <Conversation
        id={id}
        requester={report.username || report.email}
        requesterUsername={report.username}
        onChange={onChange}
      />
      {linked ? (
        <>
          <p className="support-inbox__hint">
            Access is recorded in the audit log, including after resolution.
          </p>
          <div
            className="support-inbox__views"
            role="group"
            aria-label="Investigation views"
          >
            <Button
              aria-pressed={kind === 'messages'}
              onClick={() => setKind('messages')}
            >
              View conversation
            </Button>
            <Button
              aria-pressed={kind === 'experiences'}
              onClick={() => setKind('experiences')}
            >
              View experiences
            </Button>
          </div>
          {kind && <Investigation key={kind} id={id} kind={kind} />}
        </>
      ) : (
        report.category === 'reportMember' && (
          <p>
            No verified member pair. Private conversation and experiences are
            unavailable.
          </p>
        )
      )}
    </section>
  );
}

function MemberSearch() {
  const [search, setSearch] = useState('');
  const [members, setMembers] = useState<SupportMember[]>([]);
  const [failed, setFailed] = useState(false);
  const [searched, setSearched] = useState(false);
  const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFailed(false);
    setSearched(false);
    setMembers([]);
    setPending(true);
    try {
      const results = await api.load<SupportMember[]>(
        `/api/admin/support-members?search=${encodeURIComponent(search)}`,
      );
      setMembers(Array.isArray(results) ? results : []);
      setSearched(true);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }
  return (
    <section
      className="support-inbox__card support-inbox__search"
      aria-label="Member search"
    >
      <form onSubmit={submit}>
        <label htmlFor="support-member-search">Name, username or email</label>
        <input
          className="form-control"
          id="support-member-search"
          value={search}
          minLength={3}
          maxLength={254}
          required
          onChange={event => setSearch(event.target.value)}
        />
        <Button type="submit" disabled={pending}>
          Search members
        </Button>
      </form>
      {pending && <p role="status">Searching…</p>}
      {failed && <ResourceState failed />}
      {searched && members.length === 0 && !failed && <p>No members found.</p>}
      <ul>
        {members.map(member => (
          <li key={member._id}>
            <a
              href={`/admin/support/member/${encodeURIComponent(member.username)}`}
            >
              {member.username} ({member.displayName})
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SupportMemberSearchPage() {
  return (
    <>
      <AdminHeader />
      <main className="container">
        <h1>Member search</h1>
        <MemberSearch />
      </main>
    </>
  );
}

export function SupportMemberPage({ id }: { id: string }) {
  const { data: member, failed } = useResource<SupportMember>(
    `/api/admin/support-members/${encodeURIComponent(id)}`,
  );
  const canOpenAdminUserPage = useAuth().hasRole('admin');
  useEffect(() => {
    if (member && id !== member.username) {
      window.history.replaceState(
        window.history.state,
        '',
        `/admin/support/member/${encodeURIComponent(member.username)}`,
      );
    }
  }, [id, member]);
  return (
    <>
      <AdminHeader />
      <main className="container">
        <p>
          <a href="/admin/support">Support inbox</a>
        </p>
        {!member ? (
          <ResourceState failed={failed} />
        ) : (
          <>
            <h1>
              {canOpenAdminUserPage ? (
                <a href={`/admin/user/${encodeURIComponent(member.username)}`}>
                  {member.username} ({member.displayName})
                </a>
              ) : (
                `${member.username} (${member.displayName})`
              )}
            </h1>
            <UserState user={member} />
            {member.pendingDeletion && <p>Pending deletion</p>}
            <p>{member.email}</p>
            <p>{member.tagline}</p>
            <div style={{ whiteSpace: 'pre-wrap' }}>
              {plainText(member.description)}
            </div>
            <p>
              Living: {member.locationLiving} · From: {member.locationFrom}
            </p>
            <p>Languages: {member.languages?.join(', ')}</p>
            <AdminNotes id={member._id} />
          </>
        )}
      </main>
    </>
  );
}

export default function SupportInbox({ requestId }: { requestId?: string }) {
  const [location, setLocation] = useState<InboxLocation>(() => {
    const current = readInboxLocation();
    return requestId ? { ...current, requestId } : current;
  });
  const [searchDraft, setSearchDraft] = useState(location.q);
  const [data, setData] = useState<SupportQueueResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [routeRequestId, setRouteRequestId] = useState(requestId ?? null);
  const selected = routeRequestId ?? location.requestId;
  const canImport = useAuth().hasRole('admin');

  useEffect(() => {
    if (requestId !== undefined) {
      setRouteRequestId(requestId);
      setLocation(current => ({ ...current, requestId }));
    }
  }, [requestId]);

  useEffect(() => {
    const syncLocation = () => {
      const next = readInboxLocation();
      setLocation(next);
      setSearchDraft(next.q);
      setRouteRequestId(next.requestId);
    };
    window.addEventListener('popstate', syncLocation);
    return () => window.removeEventListener('popstate', syncLocation);
  }, []);

  useEffect(() => {
    if (searchDraft === location.q) return undefined;
    const timer = window.setTimeout(() => {
      const next = {
        ...location,
        q: searchDraft.slice(0, SEARCH_LIMIT),
        page: 1,
      };
      setLocation(next);
      writeInboxLocation(next, true);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [location, searchDraft]);

  useEffect(() => {
    let active = true;
    setData(null);
    setFailed(false);
    api
      .listRequests({
        status: location.status,
        category: location.category || undefined,
        page: location.page,
        q: location.q || undefined,
      })
      .then(value => {
        if (active) setData(value);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [location.status, location.category, location.page, location.q, revision]);

  function updateLocation(patch: Partial<InboxLocation>, replace = false) {
    const next = { ...location, ...patch };
    setLocation(next);
    if (patch.requestId !== undefined) setRouteRequestId(patch.requestId);
    writeInboxLocation(next, replace);
  }

  function reloadQueue() {
    setRevision(value => value + 1);
  }

  const start = data?.items.length ? (data.page - 1) * 50 + 1 : 0;
  const end = data?.items.length ? start + data.items.length - 1 : 0;
  return (
    <>
      <AdminHeader />
      <main className="container support-inbox">
        <header className="support-inbox__intro">
          <h1>Support inbox</h1>
          <p>
            Triage requests and keep the full support conversation in one place.
          </p>
        </header>
        {canImport && <SupportStatusImport onApplied={reloadQueue} />}
        <div className="support-inbox__layout">
          <div className="support-inbox__sidebar">
            <section
              className="support-inbox__card support-inbox__queue"
              aria-label="Request queue"
            >
              <h2>Requests</h2>
              <div className="support-inbox__filters">
                <div>
                  <label htmlFor="support-status">Status</label>
                  <select
                    className="form-control"
                    id="support-status"
                    value={location.status}
                    onChange={event => {
                      updateLocation({ status: event.target.value, page: 1 });
                    }}
                  >
                    <option value="unresolved">Unresolved</option>
                    <option value="unconfirmed">
                      Unconfirmed legacy status
                    </option>
                    {SUPPORT_STATUSES.map(value => (
                      <option key={value} value={value}>
                        {SUPPORT_STATUS_LABELS[value]}
                      </option>
                    ))}
                    <option value="all">All</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="support-category">Category</label>
                  <select
                    className="form-control"
                    id="support-category"
                    value={location.category}
                    onChange={event => {
                      updateLocation({ category: event.target.value, page: 1 });
                    }}
                  >
                    <option value="">All categories</option>
                    {Object.entries(SUPPORT_CATEGORIES).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </div>
                <div>
                  <label htmlFor="support-request-search">
                    Search requests
                  </label>
                  <input
                    className="form-control"
                    id="support-request-search"
                    type="search"
                    maxLength={SEARCH_LIMIT}
                    value={searchDraft}
                    onChange={event =>
                      setSearchDraft(event.target.value.slice(0, SEARCH_LIMIT))
                    }
                  />
                </div>
              </div>
              {!data ? (
                <>
                  <ResourceState failed={failed} />
                  {failed && <button onClick={reloadQueue}>Retry</button>}
                </>
              ) : (
                <>
                  <p className="support-inbox__counts" aria-live="polite">
                    {`Showing ${start}–${end} of ${data.matchingTotal} matching requests (${data.total} total)`}
                  </p>
                  <ul
                    className="support-inbox__status-counts"
                    aria-label="Request counts by status"
                  >
                    {SUPPORT_STATUSES.map(value => (
                      <li key={value}>
                        <button
                          type="button"
                          aria-pressed={location.status === value}
                          onClick={() =>
                            updateLocation({ status: value, page: 1 })
                          }
                        >
                          <span>{SUPPORT_STATUS_LABELS[value]}</span>{' '}
                          <strong>{data.statusCounts[value]}</strong>
                        </button>
                      </li>
                    ))}
                    <li>
                      <button
                        type="button"
                        aria-pressed={location.status === 'unconfirmed'}
                        onClick={() =>
                          updateLocation({ status: 'unconfirmed', page: 1 })
                        }
                      >
                        <span>Unconfirmed legacy status</span>{' '}
                        <strong>{data.unconfirmedCount ?? 0}</strong>
                      </button>
                    </li>
                  </ul>
                  {data.items.length === 0 && (
                    <p className="support-inbox__empty">
                      No support requests match these filters.
                    </p>
                  )}
                  <ul className="support-inbox__list">
                    {data.items.map(report => (
                      <li key={report._id}>
                        <button
                          className="support-inbox__queue-item"
                          aria-pressed={selected === report._id}
                          aria-label={`${report.username || report.email} · ${
                            SUPPORT_CATEGORIES[
                              report.category as keyof typeof SUPPORT_CATEGORIES
                            ]
                          }`}
                          onClick={() =>
                            updateLocation({ requestId: report._id })
                          }
                        >
                          <strong>
                            {
                              SUPPORT_CATEGORIES[
                                report.category as keyof typeof SUPPORT_CATEGORIES
                              ]
                            }
                          </strong>
                          {report.subject && (
                            <span className="support-inbox__queue-subject">
                              {decodeSupportText(report.subject)}
                            </span>
                          )}
                          <span>{report.username || report.email}</span>
                          <span className="support-inbox__queue-meta">
                            <time dateTime={report.sent}>
                              {formatAdminDateTime(report.sent)}
                            </time>
                            <span
                              className="support-inbox__status"
                              data-status={normaliseSupportStatus(
                                report.status,
                              )}
                            >
                              {report.statusProvenance === 'missing'
                                ? 'Unconfirmed legacy status'
                                : SUPPORT_STATUS_LABELS[
                                    normaliseSupportStatus(report.status)
                                  ]}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <Pager
                    page={location.page}
                    hasMore={data.hasMore}
                    onPage={nextPage => updateLocation({ page: nextPage })}
                  />
                </>
              )}
            </section>
          </div>
          <div className="support-inbox__detail">
            {selected ? (
              <RequestDetails
                key={selected}
                id={selected}
                onChange={reloadQueue}
              />
            ) : (
              <div className="support-inbox__card support-inbox__empty-detail">
                <h2>Request details</h2>
                <p>Select a request to view its details.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
