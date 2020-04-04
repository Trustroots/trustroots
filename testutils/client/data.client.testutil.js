import faker from 'faker';
import range from 'lodash/range';

import { generateClientUser, generateId } from '../common/data.common.testutil';

export { generateClientUser };

export function generateThreads(count, { userFrom, userTo } = {}) {
  return range(count).map(() => generateThread({ userFrom, userTo }));
}

function generateThread({
  userFrom = generateClientUser(),
  userTo = generateClientUser(),
} = {}) {
  return {
    _id: generateId(),
    read: true,
    updated: new Date().toISOString(),
    message: {
      excerpt: faker.lorem.sentence(),
    },
    userFrom,
    userTo,
  };
}
