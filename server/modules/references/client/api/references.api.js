import axios from 'axios';
import set from 'lodash/set';
import get from 'lodash/get';
import has from 'lodash/has';

/**
 * Map one object to another and back given a mapping. If the original path doesn't exist, it is skipped.
 * @param {Object} object - object to map
 * @param {[string, string][]} mapping - (array of pairs of paths) map values from 'some.path' to 'other.path'
 * @param {boolean=false} backwards - map from the 2nd to 1st path, i.e. backwards
 * @returns {Object} - the result of mapping
 */
function mapObjectToObject(object, mapping, backwards=false) {
  const output = {};
  mapping.forEach(([key1, key2]) => {
    const pathFrom = ((backwards) ? key2 : key1);
    const pathTo = ((backwards) ? key1 : key2);

    if (has(object, pathFrom)) {
      set(output, pathTo, get(object, pathFrom));
    }
  });

  return output;
}

/**
 * mapping from flat references (react state) to nested ones (API requests and responses)
 */
const referenceMapping = [
  ['met', 'interactions.met'],
  ['hostedMe', 'interactions.hostedMe'],
  ['hostedThem', 'interactions.hostedThem'],
  ['recommend', 'recommend'],
  ['userTo', 'userTo'],
  ['public', 'public']
];

/**
 * API request: create a reference
 * @param {object} reference - reference to save
 * @returns Promise<Reference> - saved reference
 */
export async function create(reference) {
  const requestReference = mapObjectToObject(reference, referenceMapping);
  const { data: responseReference } = await axios.post('/api/references', requestReference);
  return mapObjectToObject(responseReference, referenceMapping, true);
}

/**
 * API request: read references and filter by userFrom and userTo
 * @param {string} userFrom - id of user who gave the reference
 * @param {string} userTo - id of user who received the reference
 * @returns Promise<Reference[]> - array of the found references
 */
export async function read({ userFrom, userTo }) {
  const { data: references } = await axios.get(`/api/references?userFrom=${userFrom}&userTo=${userTo}`);
  return references.map(reference => mapObjectToObject(reference, referenceMapping, true));
}

/**
 * API request: report a member
 * @TODO this request belongs to a different module
 * @param {object} user - member to report
 * @param {string} message - message to administrators
 * @returns Promise<void>
 */
export async function report(user, message) {
  await axios.post('/api/support', { message, reportMember: user.username });
}
