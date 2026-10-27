import type { ReducedZendeskStatusItem } from '../../../../bin/db-maintenance/prepare-zendesk-statuses.mts';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const childProcess: typeof import('node:child_process') = require('node:child_process');
const fs: typeof import('node:fs') = require('node:fs');
const path: typeof import('node:path') = require('node:path');
const emailService: typeof import('../../../../modules/core/server/services/email.server.service.mjs') = require('../../../../modules/core/server/services/email.server.service.mjs');
const {
  supportRequestFingerprint,
} = require('../../server/services/support-fingerprint.server.service.mts');
const {
  extractTicketStatusItem,
  parseSupportRequestTemplate,
  prepareZendeskStatusFiles,
  prepareZendeskStatusManifest,
}: typeof import('../../../../bin/db-maintenance/prepare-zendesk-statuses.mts') = require('../../../../bin/db-maintenance/prepare-zendesk-statuses.mts');

async function renderedTemplate({
  category = 'Other',
  email = 'visitor@example.org',
  message = 'A fictional request.',
}: {
  category?: string;
  email?: string;
  message?: string;
} = {}) {
  return new Promise<string>((resolve, reject) => {
    emailService.renderEmail(
      'support-request',
      {
        from: 'Trustroots Support <support@example.org>',
        name: 'Trustroots Support',
        email: 'support@example.org',
        replyTo: { address: email },
        subject: `Support request [${category}]`,
        request: {
          category: category === 'Other' ? 'other' : 'account',
          categoryLabel: category,
          email,
          message,
          username: 'fictional-member',
          authenticated: false,
        },
        skipHtmlTemplate: true,
        sparkpostCampaign: 'support-request',
      },
      (error, rendered) => {
        if (error) reject(error);
        else resolve(rendered!.text);
      },
    );
  });
}

function legacyTemplate({
  reportMember,
  usernameLabel = 'Username',
}: {
  reportMember?: string;
  usernameLabel?: 'Username' | 'From username';
} = {}) {
  return `${reportMember ? `Reporting member: ${reportMember}\n` : ''}A fictional request.\n\n-- \n${usernameLabel}: fictional-member\nEmail: visitor@example.org\nAuthenticated: no\n`;
}

function ticket(
  description: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 123,
    status: 'pending',
    updated_at: '2025-02-03T04:05:06.000Z',
    description,
    ...overrides,
  };
}

describe('prepare Zendesk status manifest', () => {
  let renderedBody: string;

  before(async () => {
    renderedBody = await renderedTemplate();
  });

  it('extracts only the known rendered template and returns a reduced fingerprint item', async () => {
    const request = parseSupportRequestTemplate(
      await renderedTemplate({
        category: 'Account help',
        email: ' Visitor@Example.org ',
      }),
    );
    assert.deepEqual(request, {
      category: 'account',
      email: 'visitor@example.org',
      message: 'A fictional request.',
    });

    const item = extractTicketStatusItem(ticket(renderedBody));
    assert.equal(item?.zendeskTicketId, 123);
    assert.equal(item?.status, 'pending');
    assert.equal(item?.updatedAt, '2025-02-03T04:05:06.000Z');
    assert.match(item?.fingerprint || '', /^[a-f\d]{64}$/);
    assert.equal(JSON.stringify(item).includes('fictional request'), false);
    assert.equal(JSON.stringify(item).includes('visitor@example.org'), false);
  });

  it('skips unsupported statuses, malformed templates, and invalid emails', async () => {
    assert.equal(
      extractTicketStatusItem(ticket(renderedBody, { status: 'escalated' })),
      null,
    );
    assert.equal(extractTicketStatusItem(ticket('unrecognised')), null);
    assert.equal(
      parseSupportRequestTemplate(
        await renderedTemplate({ email: 'not-an-email' }),
      ),
      null,
    );
    assert.equal(
      parseSupportRequestTemplate(
        await renderedTemplate({ category: 'Unknown category' }),
      ),
      null,
    );
  });

  it('recognises the historical category-less template without reading usernames', () => {
    assert.deepEqual(
      parseSupportRequestTemplate(
        legacyTemplate({ reportMember: 'fictional-target' }),
      ),
      {
        category: 'reportMember',
        email: 'visitor@example.org',
        message: 'A fictional request.',
      },
    );
    assert.deepEqual(
      parseSupportRequestTemplate(
        legacyTemplate({ usernameLabel: 'From username' }),
      ),
      {
        category: 'other',
        email: 'visitor@example.org',
        message: 'A fictional request.',
      },
    );
  });

  it('keeps URL text aligned with the stored request fingerprint', async () => {
    const message = 'Please check https://example.org/help?topic=fictional';
    const rendered = await renderedTemplate({ message });
    const request = parseSupportRequestTemplate(rendered);
    assert.equal(request?.message, message);
    assert.equal(
      request && supportRequestFingerprint(request),
      supportRequestFingerprint({
        category: 'other',
        email: 'visitor@example.org',
        message,
      }),
    );
  });

  it('uses the outer rendered footer when request text contains a footer-shaped block', async () => {
    const message = [
      'A fictional request.',
      '',
      '-- ',
      'From username: forged-member',
      'Email: forged@example.org',
      'Authenticated: yes',
      '',
      'This is still request content.',
    ].join('\n');
    const request = parseSupportRequestTemplate(
      await renderedTemplate({ message }),
    );
    assert.deepEqual(request, {
      category: 'other',
      email: 'visitor@example.org',
      message,
    });
  });

  it('excludes every record that repeats a Zendesk ticket ID', () => {
    const { manifest, counts } = prepareZendeskStatusManifest(
      [[ticket(renderedBody), ticket(renderedBody, { status: 'solved' })]],
      new Date('2026-10-27T00:00:00.000Z'),
    );
    assert.deepEqual(manifest, {
      version: 1,
      exportedAt: '2026-10-27T00:00:00.000Z',
      items: [],
    });
    assert.deepEqual(counts, {
      records: 2,
      included: 0,
      skipped: 2,
      duplicateTicketIds: 2,
    });
  });

  it('reads export pages and writes a private reduced JSON file', async () => {
    const directory = fs.mkdtempSync(
      path.join(process.cwd(), '.tmp-zendesk-status-'),
    );
    const input = path.join(directory, 'export.ndjson');
    const output = path.join(directory, 'reduced.json');
    try {
      fs.writeFileSync(
        input,
        `${JSON.stringify(ticket(renderedBody))}\n`,
        'utf8',
      );
      const counts = await prepareZendeskStatusFiles([directory], output);
      assert.deepEqual(counts, {
        records: 1,
        included: 1,
        skipped: 0,
        duplicateTicketIds: 0,
      });
      const manifest = JSON.parse(fs.readFileSync(output, 'utf8')) as {
        items: ReducedZendeskStatusItem[];
      };
      assert.equal(manifest.items.length, 1);
      assert.equal((fs.statSync(output).mode & 0o777).toString(8), '600');

      const script = path.join(
        process.cwd(),
        'bin/db-maintenance/prepare-zendesk-statuses.mts',
      );
      const cliCounts = childProcess.execFileSync(
        process.execPath,
        [script, '--', '--output', output, input],
        { encoding: 'utf8' },
      );
      assert.deepEqual(JSON.parse(cliCounts), counts);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
