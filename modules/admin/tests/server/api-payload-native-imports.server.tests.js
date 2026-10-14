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
        'modules/admin/server/services/staff-blockers-payload.server.service.mts',
      ),
    ).href;
    const experiences = pathToFileURL(
      path.join(
        root,
        'modules/experiences/server/services/experience-payload.server.service.mts',
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
    assert.deepEqual(JSON.parse(output), Array(6).fill('function'));
  });

  it('keeps the payload builders available through synchronous CommonJS adapters', () => {
    const root = path.resolve(__dirname, '../../../..');
    const adapterPaths = {
      profile: path.join(
        root,
        'modules/users/server/services/profile-response.server.service.cjs',
      ),
      profileImplementation: path.join(
        root,
        'modules/users/server/services/profile-response.server.service.mts',
      ),
      staff: path.join(
        root,
        'modules/admin/server/services/staff-blockers-payload.server.service.cjs',
      ),
      staffImplementation: path.join(
        root,
        'modules/admin/server/services/staff-blockers-payload.server.service.mts',
      ),
      experiences: path.join(
        root,
        'modules/experiences/server/services/experience-payload.server.service.cjs',
      ),
      experiencesImplementation: path.join(
        root,
        'modules/experiences/server/services/experience-payload.server.service.mts',
      ),
      messages: path.join(
        root,
        'modules/messages/server/services/messages-payload.server.service.cjs',
      ),
      offers: path.join(
        root,
        'modules/offers/server/services/offer-payload.server.service.cjs',
      ),
    };
    const source = `
      const assert = require('node:assert/strict');
      const profile = require(${JSON.stringify(adapterPaths.profile)});
      const profileImplementation = require(${JSON.stringify(adapterPaths.profileImplementation)});
      const staff = require(${JSON.stringify(adapterPaths.staff)});
      const staffImplementation = require(${JSON.stringify(adapterPaths.staffImplementation)});
      const experiences = require(${JSON.stringify(adapterPaths.experiences)});
      const experiencesImplementation = require(${JSON.stringify(adapterPaths.experiencesImplementation)});
      const messages = require(${JSON.stringify(adapterPaths.messages)});
      const offers = require(${JSON.stringify(adapterPaths.offers)});

      for (const name of ['profileQueryFields', 'selectProfileUpdateFields', 'selectProfileResponse', 'selectMiniProfileResponse']) {
        assert.equal(profile[name], profileImplementation[name]);
      }
      assert.equal(staff.prepareStaffBlockers, staffImplementation.prepareStaffBlockers);
      for (const name of ['prepareExperienceCount', 'prepareNewExperience', 'prepareSendingToClient']) {
        assert.equal(experiences[name], experiencesImplementation[name]);
      }
      const messageFunctions = [
        messages.prepareNewMessageFields,
        messages.prepareMessageForClient,
        messages.prepareThreadSummary,
        messages.prepareMarkReadSelector,
        messages.prepareMarkReadResponse,
        messages.prepareUnreadMessageCount,
        messages.preparePreviewMessageResponse,
      ];
      const offerFunctions = [
        offers.prepareNewOffer,
        offers.prepareOfferMutationResponse,
        offers.prepareOfferPayload,
        offers.prepareOfferSearchResults,
        offers.prepareOfferUpdate,
      ];
      assert.deepEqual([...messageFunctions, ...offerFunctions].map(value => typeof value), Array(12).fill('function'));
      console.log('CommonJS adapters expose implementation exports');
    `;
    const output = execFileSync(
      process.execPath,
      ['--input-type=commonjs', '-e', source],
      {
        env: { ...process.env, NODE_OPTIONS: '' },
        encoding: 'utf8',
      },
    );
    assert.equal(
      output.trim(),
      'CommonJS adapters expose implementation exports',
    );
  });
});
