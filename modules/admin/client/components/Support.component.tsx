import React, { useEffect, useState } from 'react';
import { plainText } from '../../../core/client/utils/filters';
import AdminHeader from './AdminHeader.component';
import AdminNotes from './AdminNotes';
import UserState from './UserState.component';
import { SUPPORT_CATEGORIES } from '../../../support/shared/categories';
import * as api from '../api/support.api';
import { formatAdminDateTime } from '../utils/admin-date';
import { getCurrentUser } from '../../../core/client/services/client-runtime';
import type {
  InvestigationItem,
  Page,
  SupportMember,
  SupportRequest,
} from '../api/support.api';

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
      <button
        className="btn btn-default"
        disabled={page === 1}
        onClick={() => onPage(page - 1)}
      >
        Previous
      </button>
      <button
        className="btn btn-default"
        disabled={!hasMore}
        onClick={() => onPage(page + 1)}
      >
        Next
      </button>
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
                  <strong>{item.userFrom?.username || 'Deleted member'}</strong>{' '}
                  → {item.userTo?.username || 'Deleted member'} ·{' '}
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
          <button className="btn btn-link" onClick={reload}>
            Retry
          </button>
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
  async function toggleStatus() {
    setSaving(true);
    setSaveFailed(false);
    try {
      await api.setStatus(
        id,
        report?.status === 'resolved' ? 'open' : 'resolved',
      );
      reload();
      onChange();
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  }
  if (!report) return <ResourceState failed={failed} />;
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
        </div>
        <span
          className="support-inbox__status"
          data-status={report.status || 'open'}
        >
          {report.status || 'open'}
        </span>
      </header>
      <dl className="support-inbox__metadata">
        <div>
          <dt>From</dt>
          <dd>{report.username || 'Signed-out visitor'}</dd>
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
      </dl>
      <div className="support-inbox__message">{report.message}</div>
      <div className="support-inbox__actions">
        <p>Reply using the existing support email system.</p>
        <button
          className="btn btn-primary"
          disabled={saving}
          onClick={toggleStatus}
        >
          {report.status === 'resolved' ? 'Reopen request' : 'Resolve request'}
        </button>
      </div>
      {saveFailed && (
        <p role="alert">Unable to update this request. Please try again.</p>
      )}
      <div className="support-inbox__members">
        <div>
          <h3>Reporter</h3>
          <p>{report.username || 'Signed-out visitor'}</p>
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
            {report.reportMember && <p>{report.reportMember}</p>}
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
            <button
              className="btn btn-default"
              aria-pressed={kind === 'messages'}
              onClick={() => setKind('messages')}
            >
              View conversation
            </button>
            <button
              className="btn btn-default"
              aria-pressed={kind === 'experiences'}
              onClick={() => setKind('experiences')}
            >
              View experiences
            </button>
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
      <h2>Member search</h2>
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
        <button className="btn btn-default" type="submit" disabled={pending}>
          Search members
        </button>
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

export function SupportMemberPage({ id }: { id: string }) {
  const { data: member, failed } = useResource<SupportMember>(
    `/api/admin/support-members/${encodeURIComponent(id)}`,
  );
  const canOpenAdminUserPage = (getCurrentUser()?.roles || []).includes(
    'admin',
  );
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

export default function SupportInbox() {
  const [status, setStatus] = useState('open');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const { data, failed, reload } = useResource<Page<SupportRequest>>(
    `/api/admin/support?status=${status}&page=${page}${
      category ? `&category=${category}` : ''
    }`,
  );
  return (
    <>
      <AdminHeader />
      <main className="container support-inbox">
        <header className="support-inbox__intro">
          <h1>Support inbox</h1>
          <p>
            Triage requests here. Reply through the existing support email
            system.
          </p>
        </header>
        <MemberSearch />
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
                    value={status}
                    onChange={event => {
                      setStatus(event.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="open">Open</option>
                    <option value="resolved">Resolved</option>
                    <option value="all">All</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="support-category">Category</label>
                  <select
                    className="form-control"
                    id="support-category"
                    value={category}
                    onChange={event => {
                      setCategory(event.target.value);
                      setPage(1);
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
              </div>
              {!data ? (
                <>
                  <ResourceState failed={failed} />
                  {failed && <button onClick={reload}>Retry</button>}
                </>
              ) : (
                <>
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
                          onClick={() => setSelected(report._id)}
                        >
                          <strong>
                            {
                              SUPPORT_CATEGORIES[
                                report.category as keyof typeof SUPPORT_CATEGORIES
                              ]
                            }
                          </strong>
                          <span>{report.username || report.email}</span>
                          <span className="support-inbox__queue-meta">
                            <time dateTime={report.sent}>
                              {formatAdminDateTime(report.sent)}
                            </time>
                            <span
                              className="support-inbox__status"
                              data-status={report.status || 'open'}
                            >
                              {report.status || 'open'}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <Pager page={page} hasMore={data.hasMore} onPage={setPage} />
                </>
              )}
            </section>
          </div>
          <div className="support-inbox__detail">
            {selected ? (
              <RequestDetails key={selected} id={selected} onChange={reload} />
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
