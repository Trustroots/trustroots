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
  const marker = `watchlist${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const uniqueDomain = `${marker}.example.org`;
  const member = createUser({
    firstName: marker,
    email: `${marker}@${uniqueDomain}`,
  });
  const ownedRules: Rule[] = [
    { kind: 'keyword', value: marker },
    { kind: 'email', value: member.email },
    { kind: 'domain', value: uniqueDomain },
  ];
  const ownedRuleKeys = new Set(
    ownedRules.map(rule => `${rule.kind}:${rule.value}`),
  );
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
    const ruleInputs = table.locator('input[id^="rule-value-"]');
    const existingRuleValues = await ruleInputs.evaluateAll(inputs =>
      inputs.map(input => (input as HTMLInputElement).value),
    );

    for (const rule of ownedRules) {
      await page.getByLabel('New rule type').selectOption(rule.kind);
      await page.getByLabel('New rule value').fill(rule.value);
      await page.getByRole('button', { name: 'Add rule' }).click();
    }
    await page.getByRole('button', { name: 'Save rules' }).click();
    await expect(page.getByRole('status')).toHaveText(
      'Signup watchlist saved.',
    );
    const savedRuleValues = await ruleInputs.evaluateAll(inputs =>
      inputs.map(input => (input as HTMLInputElement).value),
    );
    expect(savedRuleValues).toEqual([
      ...existingRuleValues,
      marker,
      member.email,
      uniqueDomain,
    ]);

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
    expect(alert?.data.text).toContain(`domain: <http://${uniqueDomain}>`);
  } finally {
    try {
      // Re-authenticate before cleanup, even if signup replaced the request
      // fixture's session cookie. Remove only this test's unique rules.
      await signInViaApi(page, request, SEEDED_ADMIN);
      let rulesRemoved = false;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const currentResponse = await request.get(rulesEndpoint);
        expect(currentResponse.ok()).toBeTruthy();
        const current = (await currentResponse.json()) as RulesResponse;
        const remainingRules = current.rules.filter(
          rule => !ownedRuleKeys.has(`${rule.kind}:${rule.value}`),
        );
        if (remainingRules.length === current.rules.length) {
          rulesRemoved = true;
          break;
        }

        const cleanup = await request.put(rulesEndpoint, {
          data: {
            revision: current.revision,
            rules: remainingRules,
            confirmEmpty: remainingRules.length === 0,
          },
        });
        if (cleanup.status() === 409) continue;
        expect(cleanup.ok()).toBeTruthy();
        rulesRemoved = true;
        break;
      }
      expect(rulesRemoved).toBeTruthy();
    } finally {
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
  }
});
