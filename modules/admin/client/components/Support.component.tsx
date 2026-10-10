import React, { useEffect, useState } from 'react';
import { plainText } from '../../../core/client/utils/filters';
import AdminHeader from './AdminHeader.component';
import AdminNotes from './AdminNotes';
import UserState from './UserState.component';
import { SUPPORT_CATEGORIES } from '../../../support/shared/categories';
import * as api from '../api/support.api';
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
    <div className="btn-group" aria-label="Pagination">
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
                  <time>{new Date(item.created).toLocaleString()}</time>
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
    <section aria-label="Support request">
      <h2>
        {SUPPORT_CATEGORIES[report.category as keyof typeof SUPPORT_CATEGORIES]}
      </h2>
      <p>
        {report.username || 'Signed-out visitor'} · {report.email} ·{' '}
        {report.status || 'open'}
      </p>
      <p style={{ whiteSpace: 'pre-wrap' }}>{report.message}</p>
      <p>Reply using the existing support email system.</p>
      <button
        className="btn btn-default"
        disabled={saving}
        onClick={toggleStatus}
      >
        {report.status === 'resolved' ? 'Reopen request' : 'Resolve request'}
      </button>
      {saveFailed && (
        <p role="alert">Unable to update this request. Please try again.</p>
      )}
      {report.user && (
        <p>
          <a href={`/admin/support/member/${report.user}`}>
            Reporter account and notes
          </a>
        </p>
      )}
      {report.reportMember && <p>Reported member: {report.reportMember}</p>}
      {report.reportedUser && (
        <p>
          <a href={`/admin/support/member/${report.reportedUser}`}>
            Reported account and notes
          </a>
        </p>
      )}
      {linked ? (
        <>
          <p>
            Access is recorded in the audit log, including after resolution.
          </p>
          <div className="btn-group">
            <button
              className="btn btn-default"
              onClick={() => setKind('messages')}
            >
              View conversation
            </button>
            <button
              className="btn btn-default"
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
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setFailed(false);
    setMembers([]);
    try {
      setMembers(
        await api.load<SupportMember[]>(
          `/api/admin/support-members?search=${encodeURIComponent(search)}`,
        ),
      );
      setSearched(true);
    } catch {
      setFailed(true);
    }
  }
  return (
    <section aria-label="Member search">
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
        <button className="btn btn-default" type="submit">
          Search members
        </button>
      </form>
      {failed && <ResourceState failed />}
      {searched && members.length === 0 && !failed && <p>No members found.</p>}
      <ul>
        {members.map(member => (
          <li key={member._id}>
            <a href={`/admin/support/member/${member._id}`}>
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
              {member.username} ({member.displayName})
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
      <main className="container">
        <h1>Support inbox</h1>
        <p>
          Triage requests here. Reply through the existing support email system.
        </p>
        <div className="row">
          <div className="col-md-5">
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
              {Object.entries(SUPPORT_CATEGORIES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {!data ? (
              <>
                <ResourceState failed={failed} />
                {failed && <button onClick={reload}>Retry</button>}
              </>
            ) : (
              <>
                {data.items.length === 0 && (
                  <p>No support requests match these filters.</p>
                )}
                <ul className="list-group">
                  {data.items.map(report => (
                    <li className="list-group-item" key={report._id}>
                      <button
                        className="btn btn-link"
                        onClick={() => setSelected(report._id)}
                      >
                        {report.username || report.email} ·{' '}
                        {
                          SUPPORT_CATEGORIES[
                            report.category as keyof typeof SUPPORT_CATEGORIES
                          ]
                        }
                      </button>
                      <div>
                        <time>{new Date(report.sent).toLocaleString()}</time> ·{' '}
                        {report.status || 'open'}
                      </div>
                    </li>
                  ))}
                </ul>
                <Pager page={page} hasMore={data.hasMore} onPage={setPage} />
              </>
            )}
            <MemberSearch />
          </div>
          <div className="col-md-7">
            {selected ? (
              <RequestDetails key={selected} id={selected} onChange={reload} />
            ) : (
              <p>Select a request to view its details.</p>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
