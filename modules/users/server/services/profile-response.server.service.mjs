/* istanbul ignore file -- implementation is covered through the CommonJS adapter. */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const service = require('./profile-response.server.service.js');

export const profileQueryFields = service.profileQueryFields;
export const selectProfileResponse = service.selectProfileResponse;
