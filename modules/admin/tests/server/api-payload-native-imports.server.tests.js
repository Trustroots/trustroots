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
    const source = `
      import { prepareStaffBlockers } from ${JSON.stringify(staff)};
      import { prepareExperienceCount, prepareNewExperience, prepareSendingToClient } from ${JSON.stringify(
        experiences,
      )};
      console.log(JSON.stringify([prepareStaffBlockers, prepareExperienceCount, prepareNewExperience, prepareSendingToClient].map(value => typeof value)));
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
    ]);
  });
});
