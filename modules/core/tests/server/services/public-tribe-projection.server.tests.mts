import assert from 'node:assert/strict';
import { publicMemberTribePopulateOptions } from '../../../server/services/public-tribe-projection.mts';

describe('public member tribe projection', () => {
  it('populates only the public fields of the member’s tribe', () => {
    assert.deepEqual(publicMemberTribePopulateOptions(), {
      path: 'member.tribe',
      select:
        '_id slug label count color image attribution attribution_url description created',
      model: 'Tribe',
    });
  });
});
