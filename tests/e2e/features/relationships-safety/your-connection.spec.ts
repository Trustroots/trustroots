import { test, expect, annotateFeature } from '../../support/fixtures.mts';
import {
  createUser,
  registerViaApi,
  signInViaApi,
} from '../../support/helpers.mts';
import {
  updateUserByUsername,
  withE2eDb,
  objectId,
} from '../../support/db.mts';
import type { Page } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

async function publicMember(page: Page, firstName = 'Cedar') {
  const member = createUser({ firstName, lastName: 'Example' });
  const created = await registerViaApi(page.request, member);
  await updateUserByUsername(member.username, {
    $set: {
      public: true,
      description:
        'A fictional member who enjoys sharing stories and welcoming travellers. '.repeat(
          4,
        ),
    },
    $unset: { emailTemporary: 1, emailToken: 1 },
  });
  return {
    ...member,
    id: created._id,
    displayName: `${member.firstName} ${member.lastName}`,
  };
}

const view = (page: Page) =>
  page.getByRole('region', { name: 'Your connection', exact: true });
const section = (page: Page, name: string) =>
  view(page).getByRole('region', { name, exact: true });
const fact = (page: Page, experience: string, label: string) =>
  section(page, experience)
    .getByRole('rowheader', { name: label, exact: true })
    .locator('..')
    .getByRole('cell');
async function readExperience(page: Page, userWith: string) {
  return (
    await page.request.get(`/api/my-experience?userWith=${userWith}`)
  ).json();
}
async function expectExperienceLayout(
  page: Page,
  layout: 'stacked' | 'side-by-side',
) {
  const cards = view(page).locator(
    '.your-connection-experiences > .your-connection-experience',
  );
  await expect(cards).toHaveCount(2);
  const positions = await cards.evaluateAll(elements =>
    elements.map(element => {
      const { x, y, height } = element.getBoundingClientRect();
      return { x, y, height };
    }),
  );
  if (layout === 'stacked') {
    expect(positions[1].y).toBeGreaterThanOrEqual(
      positions[0].y + positions[0].height,
    );
  } else {
    expect(positions[1].x).toBeGreaterThan(positions[0].x);
    expect(positions[1].y).toBe(positions[0].y);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}
async function thread(page: Page, username: string) {
  await page.goto(`/messages/${username}`);
  const disclosure = page
    .locator('summary')
    .filter({ hasText: 'Your connection' });
  await expect(disclosure).toBeVisible();
  await disclosure.focus();
  await page.keyboard.press('Enter');
  await expect(view(page)).toBeVisible();
}

for (const state of ['absent', 'incoming', 'outgoing', 'confirmed'] as const) {
  test(`profile and mobile thread agree for ${state} contacts before and after Experiences`, async ({
    page,
  }, testInfo) => {
    annotateFeature(testInfo, 'contacts.add', [
      'The private connection view agrees across profiles and mobile threads.',
    ]);
    const first = await publicMember(page);
    const second = await publicMember(page, 'Rowan');
    if (state !== 'absent') {
      await signInViaApi(
        page,
        page.request,
        state === 'incoming' ? second : first,
      );
      const contact = await page.request.post('/api/contact', {
        data: { friendUserId: state === 'incoming' ? first.id : second.id },
      });
      expect(contact.ok()).toBeTruthy();
      if (state === 'confirmed') {
        await signInViaApi(page, page.request, second);
        const record = await (
          await page.request.get(`/api/contact-by/${first.id}`)
        ).json();
        expect(
          (
            await page.request.put(`/api/contact/${record._id}`, {
              data: { confirm: true },
            })
          ).ok(),
        ).toBeTruthy();
      }
    }
    await signInViaApi(page, page.request, first);
    const status = {
      absent: 'No contact',
      incoming: 'Incoming contact request',
      outgoing: 'Outgoing contact request',
      confirmed: 'Confirmed contact',
    }[state];
    await page.goto(`/profile/${second.username}`);
    await expect(view(page).getByText(status, { exact: true })).toBeVisible();
    await expect(
      view(page).getByRole('link', { name: 'Share your experience' }),
    ).toBeVisible();
    const before = await view(page).innerText();
    await page.setViewportSize({ width: 390, height: 844 });
    if (state === 'absent') {
      await expectExperienceLayout(page, 'stacked');
      await page.setViewportSize({ width: 1024, height: 900 });
      await expectExperienceLayout(page, 'side-by-side');
      await page.setViewportSize({ width: 390, height: 844 });
    }
    await thread(page, second.username);
    await expect(view(page)).toHaveText(before, { useInnerText: true });
    await expect(page.locator('#message-reply-content')).toBeVisible();
    await expect(
      section(page, 'Private message feedback').getByRole('button'),
    ).toHaveCount(0);

    const saved = await page.request.post('/api/experiences', {
      data: {
        userTo: second.id,
        interactions: { met: true, host: true, guest: false },
        recommend: 'yes',
        feedbackPublic: 'A fictional shared meal.',
      },
    });
    expect(saved.status()).toBe(201);
    const original = await saved.json();
    await page.goto(`/profile/${second.username}`);
    await expect(
      section(page, 'Your Experience').getByText('Awaiting publication'),
    ).toBeVisible();
    await expect(
      section(page, 'Your Experience').getByText(
        `Written by ${first.displayName}`,
      ),
    ).toBeVisible();
    await expect(
      view(page).getByRole('link', { name: 'View Experiences' }),
    ).toBeVisible();
    await thread(page, second.username);
    await expect(
      view(page).getByText('A fictional shared meal.'),
    ).toBeVisible();
    await expect(view(page).getByText('You hosted this member')).toBeVisible();
    expect(await readExperience(page, second.id)).toEqual(original);

    if (state === 'confirmed') {
      await page.goto(`/profile/${second.username}`);
      await view(page)
        .getByRole('button', { name: 'Remove contact', exact: true })
        .click();
      await page.getByRole('button', { name: 'Yes, remove contact' }).click();
      await expect(
        view(page).getByText('No contact', { exact: true }),
      ).toBeVisible();
      await expect(
        view(page).getByText('A fictional shared meal.'),
      ).toBeVisible();
      expect(await readExperience(page, second.id)).toEqual(original);
    }

    await signInViaApi(page, page.request, second);
    await page.goto(`/profile/${first.username}`);
    await expect(fact(page, 'Their Experience', 'Met in person')).toHaveText(
      'Not recorded',
    );
    await expect(view(page).getByText('A fictional shared meal.')).toHaveCount(
      0,
    );
    const reply = await page.request.post('/api/experiences', {
      data: {
        userTo: first.id,
        interactions: { met: false, host: true, guest: false },
        recommend: 'no',
        feedbackPublic: 'A differing fictional account.',
      },
    });
    expect(reply.status()).toBe(201);
    await page.reload();
    await expect(fact(page, 'Your Experience', 'Met in person')).toHaveText(
      'No',
    );
    await expect(fact(page, 'Their Experience', 'Met in person')).toHaveText(
      'Yes',
    );
    await expect(
      section(page, 'Your Experience').getByText('Public', { exact: true }),
    ).toBeVisible();
    // The reciprocal contract does not carry publication state.
    await expect(
      section(page, 'Their Experience').getByText('Public', { exact: true }),
    ).toHaveCount(0);
    if (state === 'absent') {
      // Keep fixed navigation outside the panel captures.
      await page.setViewportSize({ width: 390, height: 1400 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await view(page).screenshot({
        path: testInfo.outputPath('connection-experiences-mobile.png'),
      });
      await page.setViewportSize({ width: 1024, height: 900 });
      await expectExperienceLayout(page, 'side-by-side');
      await page.evaluate(() => window.scrollTo(0, 0));
      await view(page).screenshot({
        path: testInfo.outputPath('connection-experiences-desktop.png'),
      });
    }
  });
}

test('private feedback changes from both surfaces, preserves history and is invisible to the other member', async ({
  page,
}, testInfo) => {
  annotateFeature(testInfo, 'references.thread-create-read', [
    'The viewer can change their own feedback from profiles and mobile threads.',
  ]);
  const viewer = await publicMember(page);
  const other = await publicMember(page, 'Rowan');
  await signInViaApi(page, page.request, other);
  expect(
    (
      await page.request.post('/api/messages', {
        data: { userTo: viewer.id, content: 'A fictional friendly greeting.' },
      })
    ).ok(),
  ).toBeTruthy();
  await signInViaApi(page, page.request, viewer);
  const savedExperience = await page.request.post('/api/experiences', {
    data: {
      userTo: other.id,
      interactions: { met: true, host: false, guest: true },
      recommend: 'yes',
      feedbackPublic: 'A fictional stay.',
    },
  });
  expect(savedExperience.status()).toBe(201);
  const originalExperience = await savedExperience.json();
  await page.goto(`/profile/${other.username}`);
  const feedback = () => section(page, 'Private message feedback');
  await feedback().getByRole('button', { name: 'Yes', exact: true }).click();
  await expect(
    feedback().getByRole('button', { name: 'Change' }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await thread(page, other.username);
  await expect(feedback().getByText('Yes', { exact: true })).toBeVisible();
  await feedback().getByRole('button', { name: 'Change' }).click();
  await feedback().getByRole('button', { name: 'No', exact: true }).click();
  await expect(
    feedback().getByRole('button', { name: 'Change' }),
  ).toBeVisible();
  await expect(page.locator('#message-reply-content')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('connection-mobile.png') });
  await page.goto(`/profile/${other.username}`);
  await expect(feedback().getByText('No', { exact: true })).toBeVisible();
  const history = await withE2eDb(db =>
    db
      .collection('referencethreads')
      .find({ userFrom: objectId(viewer.id), userTo: objectId(other.id) })
      .toArray(),
  );
  expect(history.map(record => record.reference).sort()).toEqual(['no', 'yes']);
  expect(await readExperience(page, other.id)).toEqual(originalExperience);
  await signInViaApi(page, page.request, other);
  const hidden = await page.request.get(`/api/references-thread/${viewer.id}`);
  expect(hidden.status()).toBe(404);
  expect((await hidden.json()).allowCreatingReference).toBe(false);
  await page.goto(`/profile/${viewer.username}`);
  await expect(feedback().getByText('Not recorded')).toBeVisible();
  await expect(feedback().getByText('No', { exact: true })).toHaveCount(0);
  await expect(feedback().getByRole('button')).toHaveCount(0);
});
