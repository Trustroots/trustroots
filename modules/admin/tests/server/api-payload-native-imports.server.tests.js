const assert = require('assert/strict');
const { execFileSync } = require('child_process');
const path = require('path');
const { pathToFileURL } = require('url');

describe('API payload native ESM imports', () => {
  it('exposes native payload functions to named imports without coverage hooks', () => {
    const root = path.resolve(__dirname, '../../../..');
    const staff = pathToFileURL(
      path.join(
        root,
        'modules/admin/server/services/staff-blockers-payload.server.service.mjs',
      ),
    ).href;
    const experiences = pathToFileURL(
      path.join(
        root,
        'modules/experiences/server/services/experience-payload.server.service.mjs',
      ),
    ).href;
    const messages = pathToFileURL(
      path.join(
        root,
        'modules/messages/server/services/messages-payload.server.service.mts',
      ),
    ).href;
    const offers = pathToFileURL(
      path.join(
        root,
        'modules/offers/server/services/offer-payload.server.service.mts',
      ),
    ).href;
    const source = `
      import { prepareStaffBlockers } from ${JSON.stringify(staff)};
      import { prepareExperienceCount, prepareNewExperience, prepareSendingToClient } from ${JSON.stringify(
        experiences,
      )};
      import { prepareNewMessageFields } from ${JSON.stringify(messages)};
      import { prepareOfferPayload } from ${JSON.stringify(offers)};
      console.log(JSON.stringify([prepareStaffBlockers, prepareExperienceCount, prepareNewExperience, prepareSendingToClient, prepareNewMessageFields, prepareOfferPayload].map(value => typeof value)));
    `;
    const output = execFileSync(
      process.execPath,
      ['--input-type=module', '-e', source],
      {
        env: { ...process.env, NODE_OPTIONS: '' },
        encoding: 'utf8',
      },
    );
    assert.deepEqual(JSON.parse(output), [
      'function',
      'function',
      'function',
      'function',
      'function',
      'function',
    ]);
  });

  it('keeps the payload builders available through synchronous CommonJS adapters', () => {
    const root = path.resolve(__dirname, '../../../..');
    const messages = path.join(
      root,
      'modules/messages/server/services/messages-payload.server.service.cjs',
    );
    const offers = path.join(
      root,
      'modules/offers/server/services/offer-payload.server.service.cjs',
    );
    const source = `
      const messages = require(${JSON.stringify(messages)});
      const offers = require(${JSON.stringify(offers)});
      console.log(JSON.stringify([
        messages.prepareNewMessageFields,
        messages.prepareMessageForClient,
        messages.prepareThreadSummary,
        messages.prepareMarkReadSelector,
        messages.prepareMarkReadResponse,
        messages.prepareUnreadMessageCount,
        messages.preparePreviewMessageResponse,
        offers.prepareNewOffer,
        offers.prepareOfferMutationResponse,
        offers.prepareOfferPayload,
        offers.prepareOfferSearchResults,
        offers.prepareOfferUpdate,
      ].map(value => typeof value)));
    `;
    const output = execFileSync(process.execPath, ['-e', source], {
      env: { ...process.env, NODE_OPTIONS: '' },
      encoding: 'utf8',
    });
    assert.deepEqual(JSON.parse(output), Array(12).fill('function'));
  });
});
