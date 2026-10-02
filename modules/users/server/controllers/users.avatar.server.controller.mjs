/* istanbul ignore file -- implementation is covered through the CommonJS adapter. */
import { createRequire } from 'node:module';

// The bounded upload pipeline remains in the CommonJS controller while the
// module migration is in progress; keep the production route on that pipeline.
const require = createRequire(import.meta.url);
// Keep this route adapter on the CommonJS controller until the migration ends.
// eslint-disable-next-line import/no-commonjs
const defaultExport = require('./users.avatar.server.controller.js');

export default defaultExport;
export const avatarUpload = defaultExport.avatarUpload;
export const avatarUploadField = defaultExport.avatarUploadField;
export const getAvatar = defaultExport.getAvatar;
export const userForAvatarByUserId = defaultExport.userForAvatarByUserId;
