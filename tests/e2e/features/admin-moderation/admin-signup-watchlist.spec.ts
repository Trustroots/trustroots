import { annotateFeature, expect, test } from '../../support/fixtures.mts';
import {
  createUser,
  registerViaApi,
  SEEDED_ADMIN,
  signInViaApi,
} from '../../support/helpers.mts';
import { withE2eDb } from '../../support/db.mts';

interface Rule {
  kind: 'keyword' | 'email' | 'domain';
  value: string;
}
interface RulesResponse {
  revision: number;
  rules: Rule[];
}
interface E2eAgendaJob {
  name: string;
  data: {
    subject?: string;
    text?: string;
    to?: { address?: string };
  };
}

const rulesEndpoint = '/api/admin/signup-review-rules';

test('admins can manage the signup watchlist and matching signups are flagged but allowed', async ({
  page,
  request,
}, testInfo) => {
  annotateFeature(testInfo, 'admin.signup-watchlist', [
    'Administrators can manage keyword, email, and domain watchlist rules.',
    'A matching signup is allowed and queues an alert for staff.',
  ]);

  await signInViaApi(page, request, SEEDED_ADMIN);
  const originalResponse = await request.get(rulesEndpoint);
  expect(originalResponse.ok()).toBeTruthy();
  const original = (await originalResponse.json()) as RulesResponse;
  const marker = `watchlist${Date.now()}`;
  const member = createUser({ firstName: marker });
  let registered = false;

  try {
    await page.goto('/admin/signup-review-rules');
    const table = page.getByRole('table', { name: 'Watchlist rules' });
    await expect(
      page.getByRole('heading', { name: 'Signup watchlist' }),
    ).toBeVisible();
    await expect(table).toBeVisible();
    await expect(
      page.getByText(/Matching signups are allowed and flagged/),
    ).toBeVisible();

    while (await table.getByRole('button', { name: /Remove rule/ }).count()) {
      await table.getByRole('button', { name: 'Remove rule 1' }).click();
    }

    for (const rule of [
      { kind: 'keyword', value: marker },
      { kind: 'email', value: member.email },
      { kind: 'domain', value: 'example.test' },
    ] as const) {
      await page.getByLabel('New rule type').selectOption(rule.kind);
      await page.getByLabel('New rule value').fill(rule.value);
      await page.getByRole('button', { name: 'Add rule' }).click();
    }
    await page.getByRole('button', { name: 'Save rules' }).click();
    await expect(page.getByRole('status')).toHaveText(
      'Signup watchlist saved.',
    );
    await expect(page.getByLabel('Rule 1 value')).toHaveValue(marker);
    await expect(page.getByLabel('Rule 2 value')).toHaveValue(member.email);
    await expect(page.getByLabel('Rule 3 value')).toHaveValue('example.test');

    const result = await registerViaApi(request, member);
    registered = true;
    expect(result._id).toMatch(/^[a-f\d]{24}$/i);
    const storedMember = await withE2eDb(db =>
      db.collection('users').findOne({ username: member.username }),
    );
    expect(storedMember).not.toBeNull();

    await expect
      .poll(() =>
        withE2eDb(db =>
          db.collection<E2eAgendaJob>('agendaJobs').findOne({
            name: 'send email',
            'data.subject': 'Signup matched safety-review keywords',
            'data.text': { $regex: member.username },
          }),
        ),
      )
      .not.toBeNull();

    const alert = await withE2eDb(db =>
      db.collection<E2eAgendaJob>('agendaJobs').findOne({
        name: 'send email',
        'data.subject': 'Signup matched safety-review keywords',
        'data.text': { $regex: member.username },
      }),
    );
    expect(alert?.data.text).toContain(`keyword: ${marker}`);
    expect(alert?.data.text).toContain(`email: ${member.email}`);
    expect(alert?.data.text).toContain('domain: example.test');
  } finally {
    // Re-authenticate before restoring settings, even when signup replaced the
    // request fixture's session cookie.
    await signInViaApi(page, request, SEEDED_ADMIN);
    const currentResponse = await request.get(rulesEndpoint);
    if (currentResponse.ok()) {
      const current = (await currentResponse.json()) as RulesResponse;
      const restored = await request.put(rulesEndpoint, {
        data: { revision: current.revision, rules: original.rules },
      });
      expect(restored.ok()).toBeTruthy();
    }
    await withE2eDb(async db => {
      await db.collection('users').deleteOne({ username: member.username });
      if (registered) {
        await db.collection('agendaJobs').deleteMany({
          'data.to.address': member.email,
        });
        await db.collection('agendaJobs').deleteMany({
          'data.text': { $regex: member.username },
        });
      }
    });
  }
});
