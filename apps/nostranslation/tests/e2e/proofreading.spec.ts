import { test, expect } from '@playwright/test';
import type { Catalogue, Submission } from '../../shared.ts';

function catalogue(): Catalogue {
  return {
    locale: 'de',
    revision: 'revision',
    entries: [
      {
        id: 'users:Welcome',
        namespace: 'users',
        key: 'Welcome',
        source: 'Welcome {{name}}',
        sourceHash: 'a'.repeat(64),
        original: null,
        needsReview: true,
        suggestion: 'Willkommen {{name}}',
        model: 'example-model',
      },
      {
        id: 'users:Hello',
        namespace: 'users',
        key: 'Hello',
        source: 'Hello',
        sourceHash: 'b'.repeat(64),
        original: 'Hallo',
        needsReview: false,
      },
    ],
  };
}

test('proofread an AI draft and submit a correction through a Nostr signer', async ({
  page,
}, testInfo) => {
  const submissions: Submission[] = [];
  await page.route('https://translation-api.example/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
        },
      });
      return;
    }
    let body: unknown;
    if (path === '/api/languages')
      body = [{ code: 'de', label: 'Deutsch', english: 'German' }];
    else if (path === '/api/catalogue') body = catalogue();
    else {
      const submission = request.postDataJSON() as Submission;
      submissions.push(submission);
      const event = JSON.parse(
        Buffer.from(
          request.headers().authorization.slice(6),
          'base64',
        ).toString(),
      );
      expect(event.kind).toBe(27235);
      expect(event.tags).toContainEqual([
        'u',
        'https://translation-api.example/api/reviews',
      ]);
      body = { url: 'https://github.com/Trustroots/trustroots/pull/99999' };
    }
    await route.fulfill({
      json: body,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  });
  await page.addInitScript(() => {
    Object.assign(window, {
      nostr: {
        getPublicKey: async () => 'a'.repeat(64),
        signEvent: async (event: object) => ({
          ...event,
          id: 'b'.repeat(64),
          pubkey: 'a'.repeat(64),
          sig: 'c'.repeat(128),
        }),
      },
    });
  });
  await page.goto('');
  await expect(
    page.getByRole('heading', { name: 'Proofread translations' }),
  ).toBeVisible();
  const translation = page.getByLabel('Your proposed translation');
  await translation.fill('Herzlich willkommen {{name}}');
  await page
    .getByRole('button', { name: 'Approve translation', exact: true })
    .click();
  await page.reload();
  await expect(translation).toHaveValue('Herzlich willkommen {{name}}');
  await page
    .getByRole('button', { name: 'Review approved translations' })
    .click();
  await page.getByLabel('Trustroots username').fill('fictional-translator');
  await page.getByRole('button', { name: 'Connect browser signer' }).click();
  await expect(page.getByText(/Connected key:/)).toBeVisible();
  await page.screenshot({
    path: `/tmp/nostranslation-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByRole('button', { name: 'Submit reviewed translations' })
    .click();
  await expect(
    page.getByRole('link', { name: 'View your translation PR' }),
  ).toHaveAttribute('href', /\/pull\/99999$/);
  expect(submissions).toEqual([
    expect.objectContaining({
      username: 'fictional-translator',
      locale: 'de',
      changes: [
        expect.objectContaining({ value: 'Herzlich willkommen {{name}}' }),
      ],
    }),
  ]);
});

test('improve published text and require renewed approval after every edit', async ({
  page,
}) => {
  await page.route('https://translation-api.example/**', route =>
    route.fulfill({
      json: route.request().url().includes('/languages')
        ? [{ code: 'de', label: 'Deutsch', english: 'German' }]
        : catalogue(),
      headers: { 'Access-Control-Allow-Origin': '*' },
    }),
  );
  await page.goto('');
  await page.getByLabel('Show').selectOption('all');
  const published = page
    .locator('article')
    .filter({ has: page.getByText('Hello', { exact: true }) });
  await published.getByLabel('Your proposed translation').fill('Guten Tag');
  await published
    .getByRole('button', { name: 'Approve translation', exact: true })
    .click();
  await expect(page.getByText('1 approved · 2 matching strings')).toBeVisible();
  await published.getByLabel('Your proposed translation').fill('Guten Morgen');
  await expect(
    page.getByRole('button', { name: 'Review approved translations' }),
  ).toBeDisabled();
  await page.getByLabel('Search').fill('guten morgen');
  await expect(page.locator('article')).toHaveCount(1);
  await expect(
    published.getByLabel('Your proposed translation'),
  ).toHaveAttribute('dir', 'auto');
  await published.getByRole('button', { name: 'Skip for now' }).click();
  await expect(page.locator('article')).toHaveCount(0);
  await page.getByRole('button', { name: 'Refresh translations' }).click();
  await expect(published.getByLabel('Your proposed translation')).toHaveValue(
    'Guten Morgen',
  );
});

test('preserve corrections but clear approval when English changes', async ({
  page,
}) => {
  const current = catalogue();
  await page.route('https://translation-api.example/**', route =>
    route.fulfill({
      json: route.request().url().includes('/languages')
        ? [{ code: 'de', label: 'Deutsch', english: 'German' }]
        : current,
      headers: { 'Access-Control-Allow-Origin': '*' },
    }),
  );
  await page.goto('');
  const field = page.getByLabel('Your proposed translation');
  await field.fill('Hallo {{name}}');
  await page
    .getByRole('button', { name: 'Approve translation', exact: true })
    .click();
  current.entries[0].sourceHash = 'd'.repeat(64);
  current.entries[0].source = 'Welcome back {{name}}';
  await page.getByRole('button', { name: 'Refresh translations' }).click();
  await expect(
    page.getByText('Welcome back {{name}}', { exact: true }),
  ).toBeVisible();
  await expect(field).toHaveValue('Hallo {{name}}');
  await expect(
    page.getByRole('button', { name: 'Review approved translations' }),
  ).toBeDisabled();
  await field.fill('Hallo');
  await expect(page.getByText(/Keep every/)).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Approve translation', exact: true }),
  ).toBeDisabled();
});
