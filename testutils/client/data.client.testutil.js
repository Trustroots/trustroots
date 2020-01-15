import faker from 'faker';
import range from 'lodash/range';

import {
  generateClientUser,
  generateMongoId,
} from '../common/data.common.testutil';

export { generateClientUser };

export function generateThreads(count) {
  return range(count).map(generateThread);
}

function generateThread() {
  return {
    _id: generateMongoId(),
    read: true,
    updated: new Date().toISOString(),
    message: {
      excerpt: faker.lorem.sentence(),
    },
    userFrom: generateClientUser(),
    userTo: generateClientUser(),
  };
}
