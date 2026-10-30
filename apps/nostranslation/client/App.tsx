import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import type { Catalogue, Entry, Language } from '../shared.ts';
import { validateTranslation } from '../shared.ts';
import {
  authorisation,
  browserSigner,
  bunkerSigner,
  remoteConnection,
} from './signers.ts';
import type { Signer } from './signers.ts';
import { loadDrafts, rebaseDrafts, saveDrafts } from './drafts.ts';
import type { Drafts } from './drafts.ts';

const API = __NOSTRANSLATION_API_URL__.replace(/\/$/, '');

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(API + path, options);
  const body = await response.json();
  if (!response.ok)
    throw new Error(
      body.error ?? 'The translation service is unavailable. Please retry.',
    );
  return body as T;
}

export default function App() {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [locale, setLocale] = useState('');
  const [current, setCurrent] = useState<Catalogue>();
  const [drafts, setDrafts] = useState<Drafts>({});
  const [filter, setFilter] = useState('queue');
  const [search, setSearch] = useState('');
  const [section, setSection] = useState('');
  const [page, setPage] = useState(0);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [username, setUsername] = useState('');
  const [signer, setSigner] = useState<Signer>();
  const [publicKey, setPublicKey] = useState('');
  const [bunker, setBunker] = useState('');
  const [qr, setQR] = useState('');
  const [uri, setURI] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [pr, setPR] = useState('');
  const [refresh, setRefresh] = useState(0);
  const remote = useRef<AbortController | undefined>(undefined);
  const connected = useRef<Signer | undefined>(undefined);

  useEffect(() => {
    request<Language[]>('/api/languages')
      .then(values => {
        setLanguages(values);
        setLocale(values[0]?.code ?? '');
      })
      .catch(error => setMessage(error.message));
    return () => {
      remote.current?.abort();
      void connected.current?.close?.();
    };
  }, []);

  useEffect(() => {
    if (!locale) return;
    let live = true;
    setCurrent(undefined);
    setReviewing(false);
    setPage(0);
    setSkipped(new Set());
    request<Catalogue>('/api/catalogue?locale=' + encodeURIComponent(locale))
      .then(value => {
        if (!live) return;
        const saved = rebaseDrafts(loadDrafts(locale), value.entries);
        setDrafts(saved);
        setCurrent(value);
        if (!saveDrafts(locale, saved))
          setMessage(
            'Your browser cannot save drafts. Keep this page open until you submit.',
          );
      })
      .catch(error => {
        if (live) setMessage(error.message);
      });
    return () => {
      live = false;
    };
  }, [locale, refresh]);

  function update(entry: Entry, value: string, approved: boolean) {
    const next = {
      ...drafts,
      [entry.id]: {
        value,
        approved,
        sourceHash: entry.sourceHash,
        original: entry.original,
      },
    };
    setDrafts(next);
    if (!saveDrafts(locale, next))
      setMessage(
        'Your browser cannot save drafts. Keep this page open until you submit.',
      );
  }

  async function connect(getSigner: () => Promise<Signer> | Signer) {
    setBusy(true);
    setMessage('');
    try {
      const next = await getSigner();
      let key: string;
      try {
        key = await next.getPublicKey();
      } catch (error) {
        await next.close?.();
        throw error;
      }
      await connected.current?.close?.();
      connected.current = next;
      setSigner(next);
      setPublicKey(key);
      setQR('');
      setURI('');
    } catch {
      setMessage(
        'Could not connect the signer. Check its permissions and try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function connectQR() {
    remote.current?.abort();
    const controller = new AbortController();
    remote.current = controller;
    const connection = remoteConnection(controller.signal);
    setURI(connection.uri);
    try {
      setQR(await QRCode.toDataURL(connection.uri));
      await connect(connection.connect);
    } catch {
      setMessage(
        'Could not prepare the remote signer connection. Please retry.',
      );
    }
  }

  const approved =
    current?.entries.filter(entry => drafts[entry.id]?.approved) ?? [];
  const filtered =
    current?.entries.filter(
      entry =>
        !skipped.has(entry.id) &&
        (filter === 'all' ||
          (filter === 'missing'
            ? !entry.original
            : entry.needsReview || entry.suggestion !== undefined)) &&
        (!section || entry.namespace === section) &&
        [
          entry.source,
          entry.original,
          entry.suggestion,
          drafts[entry.id]?.value,
        ].some(value =>
          value?.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
        ),
    ) ?? [];
  const visible = reviewing
    ? approved.slice(0, 100)
    : filtered.slice(page * 20, (page + 1) * 20);
  const valueFor = (entry: Entry) =>
    drafts[entry.id]?.value ?? entry.suggestion ?? entry.original ?? '';

  async function submit(signer: Signer) {
    setBusy(true);
    setMessage('');
    try {
      if ((await signer.getPublicKey()) !== publicKey)
        throw new Error(
          'Your signer changed its key. Reconnect before submitting.',
        );
      const changes = approved.slice(0, 100).map(entry => ({
        id: entry.id,
        sourceHash: entry.sourceHash,
        original: entry.original,
        value: valueFor(entry),
      }));
      const body = JSON.stringify({
        username: username.toLowerCase().trim(),
        locale,
        changes,
      });
      const authorization = await authorisation(
        signer,
        API + '/api/reviews',
        body,
      );
      const result = await request<{ url: string }>('/api/reviews', {
        method: 'POST',
        headers: {
          Authorization: authorization,
          'Content-Type': 'application/json',
        },
        body,
      });
      const next = { ...drafts };
      for (const change of changes) delete next[change.id];
      setDrafts(next);
      saveDrafts(locale, next);
      setPR(result.url);
      setReviewing(false);
      setMessage(
        'Submitted for maintainer review. Your corrections will guide later AI drafts once merged.',
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Submission failed. Your draft is saved.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <header>
        <a href="https://team.trustroots.org/">Trustroots team</a>
        <p className="eyebrow">AI drafts · Human judgement</p>
        <h1>Nostranslation</h1>
        <p>
          Help Trustroots sound natural in your language. Proofread an AI draft
          or improve any existing translation.
        </p>
      </header>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {pr && (
        <p>
          <a href={pr} target="_blank" rel="noreferrer">
            View your translation PR
          </a>
        </p>
      )}
      <section aria-label="Choose translations" className="toolbar">
        <label>
          Language
          <select
            value={locale}
            disabled={busy}
            onChange={event => {
              setLocale(event.target.value);
              setSection('');
            }}
          >
            {languages.map(language => (
              <option key={language.code} value={language.code}>
                {language.label} · {language.english}
              </option>
            ))}
          </select>
        </label>
        <label>
          Show
          <select
            value={filter}
            onChange={event => {
              setFilter(event.target.value);
              setPage(0);
            }}
          >
            <option value="queue">Needs proofreading</option>
            <option value="missing">Missing translations</option>
            <option value="all">All translations</option>
          </select>
        </label>
        <label>
          Section
          <select
            value={section}
            onChange={event => {
              setSection(event.target.value);
              setPage(0);
            }}
          >
            <option value="">All sections</option>
            {[...new Set(current?.entries.map(entry => entry.namespace))].map(
              namespace => (
                <option key={namespace}>{namespace}</option>
              ),
            )}
          </select>
        </label>
        <label>
          Search
          <input
            type="search"
            value={search}
            onChange={event => {
              setSearch(event.target.value);
              setPage(0);
            }}
          />
        </label>
        <button onClick={() => setRefresh(value => value + 1)} disabled={busy}>
          Refresh translations
        </button>
      </section>
      {!current ? (
        <p>Loading translations…</p>
      ) : (
        <>
          <div className="queue-heading">
            <h2>
              {reviewing ? 'Review your batch' : 'Proofread translations'}
            </h2>
            <p>
              {approved.length} approved · {filtered.length} matching strings
            </p>
          </div>
          <p>
            Keep placeholders and formatting tags intact. Approved corrections
            become examples for future AI translations in this language after
            merging.
          </p>
          {visible.length === 0 && (
            <p>
              No strings here yet. Choose “All translations” to propose an
              improvement, or return when new AI drafts are ready.
            </p>
          )}
          <p id="translation-table-help" className="table-help">
            Compare wording side by side. Scroll the table sideways on smaller
            screens to reach the editor and review actions.
          </p>
          <div
            className="table-scroll"
            role="region"
            aria-label="Translation table"
            aria-describedby="translation-table-help"
            tabIndex={0}
          >
            <table className="translation-table">
              <caption className="visually-hidden">
                Translation proofreading
              </caption>
              <colgroup>
                <col className="source-column" />
                <col className="published-column" />
                <col className="proposal-column" />
                <col className="review-column" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">English source</th>
                  <th scope="col">Published translation</th>
                  <th scope="col">Your proposed translation</th>
                  <th scope="col">Review</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(entry => {
                  const value = valueFor(entry);
                  const error = validateTranslation(entry.source, value);
                  const isApproved = Boolean(drafts[entry.id]?.approved);
                  return (
                    <tr key={entry.id} className={isApproved ? 'approved' : ''}>
                      <td>
                        <span className="entry-section">{entry.namespace}</span>
                        <p className="source" dir="auto">
                          {entry.source}
                        </p>
                      </td>
                      <td>
                        <p className="previous" dir="auto">
                          {entry.original ?? 'Not translated'}
                        </p>
                      </td>
                      <td>
                        <label>
                          <span className="visually-hidden">
                            Your proposed translation
                          </span>
                          <textarea
                            dir="auto"
                            value={value}
                            disabled={busy}
                            onChange={event =>
                              update(entry, event.target.value, false)
                            }
                          />
                        </label>
                        {error && value && (
                          <p className="validation">{error}</p>
                        )}
                      </td>
                      <td>
                        <p className="review-status">
                          {isApproved
                            ? 'Approved'
                            : entry.model
                              ? 'AI draft'
                              : entry.original
                                ? 'Published translation'
                                : 'Awaiting translation'}
                        </p>
                        <div className="entry-actions">
                          <button
                            disabled={busy || Boolean(error)}
                            onClick={() => update(entry, value, !isApproved)}
                          >
                            {isApproved
                              ? 'Undo approval'
                              : 'Approve translation'}
                          </button>
                          <button
                            disabled={busy}
                            onClick={() =>
                              update(
                                entry,
                                entry.suggestion ?? entry.original ?? '',
                                false,
                              )
                            }
                          >
                            Reset
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => {
                              update(entry, value, false);
                              setSkipped(previous =>
                                new Set(previous).add(entry.id),
                              );
                            }}
                          >
                            Skip for now
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!reviewing && (
            <nav aria-label="Queue pages">
              <button
                disabled={page === 0}
                onClick={() => setPage(value => value - 1)}
              >
                Previous
              </button>
              <span>Page {page + 1}</span>
              <button
                disabled={(page + 1) * 20 >= filtered.length}
                onClick={() => setPage(value => value + 1)}
              >
                Next
              </button>
            </nav>
          )}
          <button
            disabled={!approved.length || busy}
            onClick={() => setReviewing(value => !value)}
          >
            {reviewing
              ? 'Back to proofreading'
              : 'Review approved translations'}
          </button>
        </>
      )}
      {reviewing && (
        <section
          aria-label="Submit reviewed translations"
          className="submission"
        >
          <h2>Send for maintainer review</h2>
          <p>
            Submit up to 100 approved strings as a draft PR. Nothing changes on
            Trustroots until it is merged.
          </p>
          <label>
            Trustroots username
            <input
              autoComplete="username"
              value={username}
              onChange={event => setUsername(event.target.value)}
            />
          </label>
          <p>
            Use a Nostr key linked to your public Trustroots profile.{' '}
            <a
              href="https://trustroots.org/profile/edit/networks"
              target="_blank"
              rel="noreferrer"
            >
              Manage your linked key
            </a>
            .
          </p>
          <div className="entry-actions">
            <button disabled={busy} onClick={() => void connect(browserSigner)}>
              Connect browser signer
            </button>
            <button disabled={busy} onClick={() => void connectQR()}>
              Connect with QR code
            </button>
          </div>
          {qr && (
            <div>
              <img src={qr} alt="Remote signer connection QR code" />
              <p>
                <a href={uri}>Open in your signer</a>
              </p>
              <button
                onClick={() => {
                  remote.current?.abort();
                  setQR('');
                  setURI('');
                }}
              >
                Cancel connection
              </button>
            </div>
          )}
          <label>
            Remote signer URL
            <input
              placeholder="bunker://…"
              value={bunker}
              onChange={event => setBunker(event.target.value)}
            />
          </label>
          <button
            disabled={busy || !bunker}
            onClick={() => void connect(() => bunkerSigner(bunker))}
          >
            Connect remote signer
          </button>
          {signer && <p className="key">Connected key: {publicKey}</p>}
          <button
            className="primary"
            disabled={busy || !signer || !username.trim() || !approved.length}
            onClick={signer ? () => void submit(signer) : undefined}
          >
            {busy
              ? 'Please approve in your signer…'
              : 'Submit reviewed translations'}
          </button>
        </section>
      )}
      <footer>
        Human corrections stay in Git and guide future AI drafts. Your
        unpublished edits are saved in this browser.
      </footer>
    </main>
  );
}
