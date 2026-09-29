import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const defaultExport = require('./users.authentication.server.controller.js');

export default defaultExport;
export const confirmEmail = defaultExport.confirmEmail;
export const removeOAuthProvider = defaultExport.removeOAuthProvider;
export const resendConfirmation = defaultExport.resendConfirmation;
export const signin = defaultExport.signin;
export const signout = defaultExport.signout;
export const signup = defaultExport.signup;
export const signupValidation = defaultExport.signupValidation;
export const validateEmailToken = defaultExport.validateEmailToken;
