import {
  finalizeEvent,
  generateSecretKey,
  nip19,
  verifyEvent,
  type Event,
  type EventTemplate,
} from 'nostr-tools';
import { FEATURED_NOTE_RELAYS } from '../../../../modules/core/shared/featured-nostr-notes.mts';
import { withE2eDb } from '../../support/db.mts';
import { annotateFeature, expect, test } from '../../support/fixtures.mts';
import {
  SEEDED_ADMIN,
  SEEDED_MEMBERS,
  signInViaApi,
} from '../../support/helpers.mts';

test('administrators can feature and remove a published Nostr note', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'admin.nostr', [
    'Administrators can feature and remove a published note on the homepage.',
    'Visitors can read featured notes and regular members cannot change them.',
    'An author-signed Nostr deletion request removes the note and prevents re-featuring.',
    'Administrators can publish a public note with a NIP-07 signer and feature it on the homepage.',
  ]);

  const author = generateSecretKey();
  const event = finalizeEvent(
    {
      kind: 1,
      created_at: 1780000000,
      content:
        'A fictional Trustroots announcement.\n<br> remains text.\n[Details](https://example.test/details)\n[Unsupported](javascript:ignored)',
      tags: [],
    },
    author,
  );
  const noteCode = nip19.noteEncode(event.id);
  const adminUrl = '/api/admin/nostr/featured-notes';
  const heading = page.getByRole('heading', { name: 'Trustroots updates' });
  const article = page
    .getByRole('article')
    .filter({ hasText: 'A fictional Trustroots announcement.' });

  const deletionEvents: Event[] = [];
  const publishedNotes = new Map<string, Event>();
  const publicationRelays: string[] = [];
  await page.exposeFunction(
    'signFixtureNostrEvent',
    (template: EventTemplate) => finalizeEvent(template, author),
  );
  await page.addInitScript(pubkey => {
    const signer = window as typeof window & {
      signFixtureNostrEvent(
        event: EventTemplate,
      ): Promise<ReturnType<typeof finalizeEvent>>;
    };
    window.nostr = {
      getPublicKey: async () => pubkey,
      signEvent: event => signer.signFixtureNostrEvent(event),
    };
  }, event.pubkey);

  await page.routeWebSocket(
    url => FEATURED_NOTE_RELAYS.includes(url.origin),
    relay => {
      relay.onMessage(message => {
        const [type, subscription, filter] = JSON.parse(String(message));
        if (type === 'EVENT') {
          const signed = subscription as Event;
          if (signed.kind === 1) {
            publicationRelays.push(new URL(relay.url()).origin);
            publishedNotes.set(signed.id, signed);
          }
          if (signed.kind === 5) deletionEvents.push(signed);
          relay.send(JSON.stringify(['OK', signed.id, true, 'accepted']));
          return;
        }
        if (type !== 'REQ') return;
        if (filter.ids.includes(event.id)) {
          relay.send(JSON.stringify(['EVENT', subscription, event]));
        }
        relay.send(JSON.stringify(['EOSE', subscription]));
      });
    },
  );

  try {
    await signInViaApi(page, request, SEEDED_ADMIN);
    await page.goto('/admin/nostr');
    await expect(
      page.getByRole('heading', { name: 'Featured Nostr notes' }),
    ).toBeVisible();
    const input = page.getByLabel('Nostr note link or event ID');
    const feature = page.getByRole('button', {
      name: 'Feature note',
      exact: true,
    });
    for (const reference of [
      `https://njump.me/${noteCode}`,
      `nostr:${nip19.neventEncode({ id: event.id })}`,
    ]) {
      await input.fill(reference);
      await feature.click();
      await expect(page.getByRole('status')).toHaveText(
        'Note featured on the homepage.',
      );
    }
    await expect(article).toHaveCount(1);

    await page.goto('/');
    await expect(heading).toBeVisible();
    const npub = nip19.npubEncode(event.pubkey);
    await expect(article.getByRole('link', { name: npub })).toHaveAttribute(
      'href',
      `https://njump.me/${npub}`,
    );
    await expect(article).toContainText('<br> remains text.');
    await expect(
      article.getByRole('link', { name: 'Details' }),
    ).toHaveAttribute('href', 'https://example.test/details');
    await expect(article).toContainText('[Unsupported](javascript:ignored)');
    await expect(article.getByRole('link')).toHaveCount(2);

    await page.context().clearCookies();
    await page.reload();
    await expect(heading).toBeVisible();
    await expect(article).toBeVisible();

    await signInViaApi(page, request, SEEDED_MEMBERS[0]);
    const forbidden = await page.request.post(adminUrl, { data: { event } });
    expect(forbidden.status()).toBe(403);

    await signInViaApi(page, request, SEEDED_ADMIN);
    await page.goto('/admin/nostr');
    await article.getByRole('button', { name: 'Remove from homepage' }).click();
    await expect(page.getByRole('status')).toHaveText(
      'Note removed from the homepage.',
    );
    await page.goto('/');
    await expect(article).toHaveCount(0);
    await page.goto('/admin/nostr');
    await input.fill(noteCode);
    await feature.click();
    await article
      .getByRole('button', { name: 'Request Nostr deletion' })
      .click();
    const confirmation = page.getByRole('dialog', {
      name: 'Request Nostr deletion?',
    });
    await expect(confirmation).toContainText(FEATURED_NOTE_RELAYS.join(', '));
    await confirmation
      .getByRole('button', { name: 'Sign and request deletion' })
      .click();
    await expect(page.getByRole('status')).toHaveText(
      'Deletion request published and note removed from the homepage.',
    );
    expect(deletionEvents.length).toBeGreaterThan(0);
    for (const deletion of deletionEvents) {
      expect(verifyEvent(deletion)).toBe(true);
      expect(deletion).toMatchObject({
        kind: 5,
        pubkey: event.pubkey,
        tags: [
          ['e', event.id],
          ['k', '1'],
        ],
      });
    }

    await input.fill(noteCode);
    await feature.click();
    await expect(page.getByRole('alert')).toHaveText(
      'A deletion request was recorded for this note.',
    );
    expect(
      (await (await page.request.get('/api/nostr/featured-notes')).json()).map(
        (note: { id: string }) => note.id,
      ),
    ).not.toContain(event.id);

    const content =
      'A fictional update composed in Trustroots.\n[Get involved](https://example.test/volunteering)';
    await expect(
      page.getByText('Your NIP-07 browser signer', { exact: false }),
    ).toContainText('wss://relay.trustroots.org');
    await page.getByLabel('Note text').fill(content);
    await page
      .getByRole('button', { name: 'Publish and feature note' })
      .click();
    await expect(page.getByRole('status')).toHaveText(
      'Note published to wss://relay.trustroots.org and featured on the homepage.',
    );
    expect(publishedNotes.size).toBe(1);
    expect(publicationRelays).toEqual(['wss://relay.trustroots.org']);
    const [published] = publishedNotes.values();
    expect(verifyEvent(published)).toBe(true);
    expect(published).toMatchObject({ kind: 1, pubkey: event.pubkey, content });
    await page.context().clearCookies();
    await page.goto('/');
    const publishedArticle = page
      .getByRole('article')
      .filter({ hasText: 'A fictional update composed in Trustroots.' });
    await expect(
      publishedArticle.getByRole('link', { name: 'Get involved' }),
    ).toHaveAttribute('href', 'https://example.test/volunteering');
  } finally {
    await withE2eDb(db =>
      db
        .collection<{ _id: string }>('featurednostrnotes')
        .deleteMany({ _id: { $in: [event.id, ...publishedNotes.keys()] } }),
    );
  }
});
