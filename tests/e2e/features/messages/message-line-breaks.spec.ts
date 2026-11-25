import type { Locator } from '@playwright/test';
import { annotateFeature, expect, test } from '../../support/fixtures.mts';
import { createUser, registerViaApi } from '../../support/helpers.mts';
import { updateUserByUsername } from '../../support/db.mts';

if (process.env.TRUSTROOTS_E2E_MESSAGE_WEBKIT === 'true') {
  test.use({ browserName: 'webkit' });
}

async function expectLineSpacing(
  body: Locator,
  labels: string[],
): Promise<void> {
  await expect
    .poll(() =>
      body.evaluate((element, expectedLabels) => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const tops = expectedLabels.map(label => {
          walker.currentNode = element;
          while (walker.nextNode()) {
            const index = (walker.currentNode.textContent ?? '').indexOf(label);
            if (index < 0) continue;
            const range = document.createRange();
            range.setStart(walker.currentNode, index);
            range.setEnd(walker.currentNode, index + label.length);
            return range.getBoundingClientRect().top;
          }
          return Number.NaN;
        });
        const lineHeight = tops[1] - tops[0];
        return lineHeight > 0
          ? tops
              .slice(1)
              .map((top, index) => Math.round((top - tops[index]) / lineHeight))
          : [];
      }, labels),
    )
    .toEqual([1, 2, 1, 2]);
}

test('line breaks survive draft, preview, send and reload', async ({
  page,
  browserName,
}, testInfo) => {
  annotateFeature(testInfo, 'messages.draft-preview', [
    'Typed and pasted lines keep their spacing through Preview, Send and reload.',
  ]);
  const recipient = createUser();
  const sender = createUser();
  const { _id: recipientId } = await registerViaApi(page.request, recipient);
  await registerViaApi(page.request, sender);
  for (const member of [recipient, sender]) {
    await updateUserByUsername(member.username, {
      $set: {
        public: true,
        description:
          'An example profile for a member who likes travelling and meeting other members. '.repeat(
            3,
          ),
      },
      $unset: { emailToken: '', emailTokenExpires: '', emailTokenIssuedAt: '' },
    });
  }
  if (browserName === 'webkit') {
    // The test server uses HTTP. WebKit also upgrades subresources on loopback.
    await page.route(/\/messages(?:\/|\?|$)/, async route => {
      if (route.request().resourceType() !== 'document')
        return route.continue();
      const response = await route.fetch();
      const headers = response.headers();
      const policy = headers['content-security-policy'];
      if (policy) {
        headers['content-security-policy'] = policy.replace(
          /(?:^|;)\s*upgrade-insecure-requests(?=;|$)/,
          '',
        );
      }
      return route.fulfill({ response, headers });
    });
  }
  await page.goto(`/messages/${recipient.username}?userId=${recipientId}`);
  const editor = page.locator('#message-reply-content');
  const first = `Line ${Date.now()}`;
  const labels = [
    first,
    'Second line',
    'Fourth line',
    'Pasted line',
    'Last line',
  ];
  await editor.click();
  await page.keyboard.insertText(first);
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.insertText('Second line');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await page.keyboard.insertText('Fourth line');
  await editor.evaluate(element => {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', '\nPasted line\n\nLast line');
    element.dispatchEvent(
      new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData,
      }),
    );
  });
  await expectLineSpacing(editor, labels);

  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  const preview = page.getByRole('region', { name: 'Message preview' });
  await expectLineSpacing(preview.locator('.panel-body'), labels);
  const sent = page.waitForResponse(
    response =>
      new URL(response.url()).pathname === '/api/messages' &&
      response.request().method() === 'POST' &&
      response.ok(),
  );
  await page.locator('#messageReplySubmit').click();
  expect((await (await sent).json()).plainText).toBe(
    `${first}\nSecond line\n\nFourth line\nPasted line\n\nLast line`,
  );

  const message = page
    .locator('.message-bubble .panel-body')
    .filter({ hasText: first });
  await expectLineSpacing(message, labels);
  await page.reload();
  await expectLineSpacing(message, labels);
  await page.goto('/messages');
  await expect(page.getByText(labels.join(' '), { exact: true })).toBeVisible();
});
