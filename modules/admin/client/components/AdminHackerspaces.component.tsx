import React, { useState } from 'react';

import AdminHeader from './AdminHeader.component';
import {
  displayNostrKey,
  fetchSigningIdentity,
  type SigningIdentity,
} from '../services/hackerspaces-signer.client.service';
import axios, {
  getErrorResponse,
} from '@/modules/core/client/api/http-client.js';
import {
  nostrService,
  type HackerPlaceRelayConnection,
} from '@/modules/search/client/services/nostr.client.service';
import {
  buildInactiveSpaceApiPlaceEvent,
  buildSpaceApiPlaceEvent,
  buildSpaceApiDeletionEvent,
  isExcludedHackerspaceAddress,
  getSpaceApiIdentifier,
  type AddressablePlaceEvent,
  type SpaceApiPlace,
} from '../services/hackerspaces-nostr.client.service';
import { Button } from '@trustroots/ui/Button';

type NostrEvent = AddressablePlaceEvent;
type Space = {
  endpoint: string;
  valid: boolean;
  eligible: boolean;
  name: string;
  website: string;
  latitude: number | null;
  longitude: number | null;
  address: string;
  addressParts: [string, string, string, string, string];
  description: string;
  open: string;
  fetchedAt: string;
  spaceType: string;
  action: 'new' | 'updated' | 'retained' | 'inactive' | 'excluded';
  excludedCountry?: boolean;
  existing?: NostrEvent;
};
declare global {
  interface Window {
    nostr?: {
      getPublicKey?: () => Promise<string>;
      signEvent?: (
        event: Record<string, unknown>,
      ) => Promise<Record<string, unknown>>;
    };
  }
}
const sourceId = (event: NostrEvent) =>
  event.tags.find(tag => tag[0] === 'd')?.[1];
const isInactive = (event: NostrEvent) =>
  event.tags.some(
    tag => tag[0] === 'meta' && tag[1] === 'status' && tag[2] === 'inactive',
  );

const previewAction = (space: Space) =>
  space.excludedCountry
    ? 'Country excluded; skip publication and request deletion of existing events'
    : space.action === 'new'
      ? 'Addition'
      : space.action === 'updated'
        ? 'Update'
        : space.action === 'retained'
          ? 'Temporarily invalid; keep last-known listing'
          : space.action === 'excluded'
            ? 'Closed; skip publication'
            : 'Closed or removed; mark inactive';

const columns = [
  {
    key: 'name',
    label: 'Space',
    value: (space: Space) => space.name || space.endpoint,
  },
  {
    key: 'address',
    label: 'Location',
    value: (space: Space) => space.address || 'No address',
  },
  { key: 'action', label: 'Preview action', value: previewAction },
  {
    key: 'website',
    label: 'Website',
    value: (space: Space) =>
      /^https?:\/\//i.test(space.website) ? space.website : '',
  },
] as const;
type SortColumn = (typeof columns)[number]['key'];

export default function AdminHackerspaces() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [deletions, setDeletions] = useState<NostrEvent[]>([]);
  const [sort, setSort] = useState<{ key: SortColumn; ascending: boolean }>({
    key: 'name',
    ascending: true,
  });
  const sortColumn = columns.find(column => column.key === sort.key)!;
  const sortedSpaces = [...spaces].sort(
    (a, b) =>
      String(sortColumn.value(a)).localeCompare(
        String(sortColumn.value(b)),
        'en',
        {
          sensitivity: 'base',
          numeric: true,
        },
      ) * (sort.ascending ? 1 : -1),
  );
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [signer, setSigner] = useState<SigningIdentity | null>(null);
  async function connectSigner() {
    setSigner(null);
    if (!window.nostr?.getPublicKey || !window.nostr?.signEvent) {
      setStatus('A NIP-07 signer is required.');
      return;
    }
    setBusy(true);
    try {
      const identity = await fetchSigningIdentity(
        await window.nostr.getPublicKey(),
      );
      setSigner(identity);
      setStatus(
        'Signing key connected. Review its identity before approving changes.',
      );
    } catch {
      setStatus('Could not connect to the relay or signer.');
    } finally {
      setBusy(false);
    }
  }
  const [relayResults, setRelayResults] = useState<
    {
      url: string;
      available: boolean;
      published: number;
      failed: number;
      reason?: string;
    }[]
  >([]);
  async function preview() {
    setBusy(true);
    setSpaces([]);
    setDeletions([]);
    setRelayResults([]);
    setStatus('Fetching the SpaceAPI Collector and published place events…');
    let fetched = false;
    try {
      const [{ data }, events] = await Promise.all([
        axios.get('/api/admin/hackerspaces/preview'),
        nostrService.fetchHackerPlaceEvents().catch(() => [] as NostrEvent[]),
      ]);
      fetched = true;
      const existing = new Map(
        events
          .filter(event => sourceId(event)?.startsWith('spaceapi:'))
          .sort(
            (a, b) => a.created_at - b.created_at || b.id.localeCompare(a.id),
          )
          .map(event => [sourceId(event)!, event]),
      );
      const excluded = new Set(
        (data as Space[])
          .filter(
            space =>
              isExcludedHackerspaceAddress(space.addressParts) ||
              isExcludedHackerspaceAddress([space.address]),
          )
          .map(space => getSpaceApiIdentifier(space.endpoint)),
      );
      const deletionEvents = events.filter(
        event =>
          sourceId(event)?.startsWith('spaceapi:') &&
          (excluded.has(sourceId(event)!) ||
            event.tags.some(
              tag =>
                tag[0] === 'address' &&
                isExcludedHackerspaceAddress(tag.slice(1)),
            )),
      );
      deletionEvents.forEach(event => excluded.add(sourceId(event)!));
      setDeletions(deletionEvents);
      const listed = new Set<string>();
      const current = (data as Space[]).map(space => {
        const id = getSpaceApiIdentifier(space.endpoint);
        listed.add(id);
        const event = existing.get(id);
        const excludedCountry = excluded.has(id);
        return {
          ...space,
          eligible:
            !excludedCountry && space.eligible && space.open !== 'closed',
          excludedCountry,
          existing: event,
          action: excludedCountry
            ? ('excluded' as const)
            : space.open === 'closed'
              ? event && !isInactive(event)
                ? ('inactive' as const)
                : ('excluded' as const)
              : space.eligible
                ? event
                  ? ('updated' as const)
                  : ('new' as const)
                : ('retained' as const),
        };
      });
      const removed = [...existing.entries()]
        .filter(
          ([id, event]) =>
            !listed.has(id) && !isInactive(event) && !excluded.has(id),
        )
        .map<Space>(([id, event]) => ({
          endpoint: id.slice('spaceapi:'.length),
          valid: true,
          eligible: false,
          name: event.tags.find(tag => tag[0] === 'name')?.[1] || id,
          website: '',
          latitude: null,
          longitude: null,
          address: '',
          addressParts: ['', '', '', '', ''],
          description: event.content,
          open: '',
          fetchedAt: new Date().toISOString(),
          spaceType: 'hackerspace',
          action: 'inactive' as const,
          existing: event,
        }));
      setSpaces([...current, ...removed]);
      setStatus(
        `Preview: ${
          current.filter(space => space.action === 'new').length
        } additions, ${
          current.filter(space => space.action === 'updated').length
        } updates, ${
          current.filter(space => space.action === 'retained').length
        } temporarily invalid or coordinate-less entries retained, ${
          [...current, ...removed].filter(space => space.action === 'inactive')
            .length
        } removals to mark inactive. ${deletionEvents.length} country-excluded events to request deletion for. Source records are not human-verified.`,
      );
    } catch (error) {
      const response = getErrorResponse(error);
      const reason = response?.data?.message;
      if (response?.status === 401 || response?.status === 403) {
        setStatus(
          'Administrator access is required. Sign in with an administrator account and retry. No events were changed.',
        );
      } else if (typeof reason === 'string' && reason) {
        setStatus(
          `Could not fetch the SpaceAPI Collector: ${reason} No events were changed.`,
        );
      } else {
        setStatus(
          fetched
            ? 'Could not prepare the import preview. No events were changed.'
            : 'Could not fetch the SpaceAPI Collector. No events were changed.',
        );
      }
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    if (!window.nostr?.getPublicKey || !window.nostr?.signEvent) {
      setStatus('A NIP-07 signer is required.');
      return;
    }
    const eligible = spaces.filter(space => space.eligible);
    const inactive = spaces.filter(
      space => space.action === 'inactive' && space.existing,
    );
    const jobs = [
      ...eligible.map(space => ({
        space,
        event: buildSpaceApiPlaceEvent({
          ...space,
          latitude: space.latitude!,
          longitude: space.longitude!,
        } as SpaceApiPlace),
      })),
      ...inactive.map(space => ({
        space,
        event: buildInactiveSpaceApiPlaceEvent(space.existing!),
      })),
      ...deletions.map(event => ({
        space: {
          name: event.tags.find(tag => tag[0] === 'name')?.[1] || event.id,
        },
        event: buildSpaceApiDeletionEvent(event),
        author: event.pubkey,
      })),
    ];
    setBusy(true);
    let published = 0;
    let failed = 0;
    let wrongAuthor = 0;
    let relays: HackerPlaceRelayConnection[] = [];
    try {
      const publicKey = await window.nostr.getPublicKey();
      if (publicKey !== signer!.publicKey) {
        setSigner(null);
        setStatus(
          'The signing key changed. Reconnect and review its identity before publishing.',
        );
        return;
      }
      relays = await nostrService.connectHackerPlaceRelays();
      const outcomes = relays.map(({ url, relay }) => ({
        url,
        available: Boolean(relay),
        published: 0,
        failed: 0,
      }));
      setRelayResults(outcomes);
      if (!relays.some(({ relay }) => relay))
        throw new Error('No publication relays available');
      for (const [index, job] of jobs.entries()) {
        setStatus(
          `Signing and publishing ${index + 1} of ${jobs.length}: ${
            job.space.name
          }`,
        );
        try {
          if ('author' in job && job.author !== publicKey) {
            wrongAuthor += 1;
            failed += 1;
            continue;
          }
          const signed = await window.nostr.signEvent(job.event);
          if (signed.pubkey !== signer!.publicKey) {
            setSigner(null);
            setStatus(
              'The signing key changed. Reconnect and review its identity before publishing.',
            );
            return;
          }
          const accepted = await Promise.all(
            relays.map(async ({ relay }, index) => {
              try {
                if (!relay) throw new Error('Relay unavailable');
                await relay.publish(signed as never);
                outcomes[index].published += 1;
                return true;
              } catch (error) {
                outcomes[index].failed += 1;
                const reason =
                  error instanceof Error ? error.message : String(error);
                Object.assign(outcomes[index], { reason });
                return false;
              }
            }),
          );
          setRelayResults(outcomes.map(outcome => ({ ...outcome })));
          if (accepted.some(Boolean)) published += 1;
          else failed += 1;
        } catch {
          failed += 1;
        }
      }
      setStatus(
        `Published ${published} place events; ${failed} failed. Events are SpaceAPI-reported and not human-verified.${
          wrongAuthor
            ? ` ${wrongAuthor} deletion requests require the original author key.`
            : ''
        }`,
      );
    } catch {
      setStatus('Could not connect to the relay or signer.');
    } finally {
      for (const { relay } of relays) relay?.close();
      setBusy(false);
    }
  }
  const toPublish =
    deletions.length > 0 ||
    spaces.some(space => space.eligible || space.action === 'inactive');
  return (
    <>
      <AdminHeader />
      <main className="container admin-hackerspaces-page">
        <h2>Hackerspaces</h2>
        <p>
          Preview the SpaceAPI Collector against published place events, then
          approve publication with your NIP-07 extension. Source validation is
          automated and does not mean a person verified the location. Trustroots
          stores no signing key. Each event is signed once and published to
          relay.trustroots.org and relay.nomadwiki.org.
        </p>
        <p>
          Listings identified as being in Russia, Israel or Belarus are excluded
          from publication. Approved changes include kind 5 deletion requests
          for existing excluded listings, signed by their original author.
          Relays may retain copies despite a deletion request.
        </p>
        <section
          className="admin-hackerspaces-signer"
          aria-label="Signing identity"
        >
          <h3>Signing identity</h3>
          <Button
            type="button"

            disabled={busy}
            onClick={connectSigner}
          >
            Connect or refresh signer
          </Button>
          {signer ? (
            <>
              <p>All approved events will be signed with this key:</p>
              <p>
                <strong>npub:</strong> <code>{signer.npub}</code>
              </p>
              <p>
                <strong>NIP-05:</strong>{' '}
                {signer.nip05
                  ? `${signer.nip05} (matches this key)`
                  : signer.lookupFailed
                    ? 'Trustroots identity lookup failed. Refresh the signer to retry.'
                    : 'No matching public Trustroots account'}
              </p>
            </>
          ) : (
            <p>
              No signing key connected. Connect your browser signer to see which
              key will sign these changes.
            </p>
          )}
        </section>
        <p>
          <Button disabled={busy} onClick={preview}>
            Fetch preview
          </Button>{' '}
          <Button
            colour="primary"
            disabled={busy || !toPublish || !signer}
            onClick={publish}
          >
            Sign and publish approved changes
          </Button>
        </p>
        <p role="status" aria-live="polite">
          {status}
        </p>
        {relayResults.length > 0 && (
          <ul aria-label="Relay publication results">
            {relayResults.map(result => (
              <li key={result.url}>
                {result.url}: {result.published} published; {result.failed}{' '}
                failed
                {result.available ? '' : '; connection unavailable'}
                {result.reason && `; ${result.reason}`}
              </li>
            ))}
          </ul>
        )}
        {deletions.length > 0 && (
          <section aria-label="Proposed deletion requests">
            <h3>Proposed deletion requests</h3>
            <ul>
              {deletions.map(event => (
                <li key={event.id}>
                  {event.tags.find(tag => tag[0] === 'name')?.[1] || event.id}
                  {' — author: '}
                  <code>{displayNostrKey(event.pubkey)}</code>
                  {' — '}
                  {signer
                    ? signer.publicKey === event.pubkey
                      ? 'Matches connected signer'
                      : 'Different author: switch to this key to delete'
                    : 'Connect signer to check ownership'}
                </li>
              ))}
            </ul>
          </section>
        )}
        {spaces.length > 0 && (
          <div className="table-responsive">
            <table className="table table-striped">
              <thead>
                <tr>
                  {columns.map(column => (
                    <th
                      key={column.key}
                      scope="col"
                      aria-sort={
                        sort.key === column.key
                          ? sort.ascending
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                      }
                    >
                      <button
                        type="button"
                        className="admin-hackerspaces-sort"
                        onClick={() =>
                          setSort({
                            key: column.key,
                            ascending:
                              sort.key === column.key ? !sort.ascending : true,
                          })
                        }
                      >
                        {column.label}
                        <span aria-hidden="true">
                          {sort.key === column.key
                            ? sort.ascending
                              ? ' ↑'
                              : ' ↓'
                            : ' ↕'}
                        </span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedSpaces.map(space => (
                  <tr key={space.endpoint}>
                    <td>{space.name || space.endpoint}</td>
                    <td>
                      {space.address || 'No address'}
                      {space.eligible && (
                        <div>
                          {space.latitude}, {space.longitude}
                        </div>
                      )}
                    </td>
                    <td>{previewAction(space)}</td>
                    <td>
                      {space.website && /^https?:\/\//i.test(space.website) && (
                        <a
                          href={space.website}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {space.website}
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
