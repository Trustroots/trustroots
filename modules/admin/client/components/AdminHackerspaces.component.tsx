import React, { useState } from 'react';

import AdminHeader from './AdminHeader.component';
import axios from '@/modules/core/client/api/http-client.js';
import { nostrService } from '@/modules/search/client/services/nostr.client.service';
import {
  buildInactiveSpaceApiPlaceEvent,
  buildSpaceApiPlaceEvent,
  getSpaceApiIdentifier,
  type AddressablePlaceEvent,
  type SpaceApiPlace,
} from '../services/hackerspaces-nostr.client.service';

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
  action: 'new' | 'updated' | 'retained' | 'inactive';
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

export default function AdminHackerspaces() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  async function preview() {
    setBusy(true);
    setStatus('Fetching the SpaceAPI Collector and published place events…');
    try {
      const [{ data }, events] = await Promise.all([
        axios.get('/api/admin/hackerspaces/preview'),
        nostrService.fetchHackerPlaceEvents().catch(() => [] as NostrEvent[]),
      ]);
      const existing = new Map(
        events
          .filter(event => sourceId(event)?.startsWith('spaceapi:'))
          .map(event => [sourceId(event)!, event]),
      );
      const listed = new Set<string>();
      const current = (data as Space[]).map(space => {
        const id = getSpaceApiIdentifier(space.endpoint);
        listed.add(id);
        const event = existing.get(id);
        return {
          ...space,
          existing: event,
          action: space.eligible
            ? event
              ? ('updated' as const)
              : ('new' as const)
            : ('retained' as const),
        };
      });
      const removed = [...existing.entries()]
        .filter(([id, event]) => !listed.has(id) && !isInactive(event))
        .map(([id, event]) => ({
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
          removed.length
        } removals to mark inactive. Source records are not human-verified.`,
      );
    } catch {
      setStatus(
        'Could not fetch the SpaceAPI Collector. No events were changed.',
      );
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
    ];
    setBusy(true);
    let published = 0;
    let failed = 0;
    try {
      await window.nostr.getPublicKey();
      const relay = await nostrService.connect();
      for (const [index, job] of jobs.entries()) {
        setStatus(
          `Signing and publishing ${index + 1} of ${jobs.length}: ${
            job.space.name
          }`,
        );
        try {
          const signed = await window.nostr.signEvent(job.event);
          await relay.publish(signed as never);
          published += 1;
        } catch {
          failed += 1;
        }
      }
      setStatus(
        `Published ${published} place events; ${failed} failed. Events are SpaceAPI-reported and not human-verified.`,
      );
    } catch {
      setStatus('Could not connect to the relay or signer.');
    } finally {
      setBusy(false);
    }
  }
  const toPublish = spaces.some(
    space => space.eligible || space.action === 'inactive',
  );
  return (
    <>
      <AdminHeader />
      <main className="container">
        <h2>Hackerspaces</h2>
        <p>
          Preview the SpaceAPI Collector against published place events, then
          approve publication with your NIP-07 extension. Source validation is
          automated and does not mean a person verified the location. Trustroots
          stores no signing key.
        </p>
        <p>
          <button className="btn btn-default" disabled={busy} onClick={preview}>
            Fetch preview
          </button>{' '}
          <button
            className="btn btn-primary"
            disabled={busy || !toPublish}
            onClick={publish}
          >
            Sign and publish approved changes
          </button>
        </p>
        <p role="status" aria-live="polite">
          {status}
        </p>
        {spaces.length > 0 && (
          <div className="table-responsive">
            <table className="table table-striped">
              <thead>
                <tr>
                  <th>Space</th>
                  <th>Location</th>
                  <th>Preview action</th>
                  <th>Website</th>
                </tr>
              </thead>
              <tbody>
                {spaces.map(space => (
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
                    <td>
                      {space.action === 'new'
                        ? 'Addition'
                        : space.action === 'updated'
                        ? 'Update'
                        : space.action === 'retained'
                        ? 'Temporarily invalid; keep last-known listing'
                        : 'Removed from directory; mark inactive'}
                    </td>
                    <td>
                      {space.website && /^https?:\/\//i.test(space.website) && (
                        <a
                          href={space.website}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Visit
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
