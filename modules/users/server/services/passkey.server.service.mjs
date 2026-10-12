import crypto from 'node:crypto';
import mongoose from 'mongoose';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import config from '../../../../config/config.mjs';
import mfa from './mfa.server.service.mjs';

export const webauthn = {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
};

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function deployment() {
  const { rpId, origins } = config.passkeys;
  if (!rpId || !Array.isArray(origins) || origins.length === 0) {
    fail('Passkeys are not configured for this site.', 503);
  }
  return { rpId, origins };
}

function sessionBinding(req) {
  return crypto
    .createHmac('sha256', config.sessionSecret)
    .update('passkey-session:' + req.sessionID)
    .digest('hex');
}

async function confirmedStaff(req) {
  if (
    !req.user ||
    !mfa.isPrivileged(req.user) ||
    req.user.mfaEnabled !== true ||
    req.user.$locals?.mfaVerified !== true
  ) {
    fail('A verified staff account is required.', 403);
  }
  const user = await mongoose.model('User').findById(req.user._id);
  if (
    !user ||
    (user.authVersion || 0) !== (req.user.authVersion || 0) ||
    !mfa.isPrivileged(user) ||
    user.mfaEnabled !== true
  ) {
    fail('Sign in again.', 403);
  }
  const password = req.body.currentPassword;
  if (
    typeof password !== 'string' ||
    !password ||
    password.length > 1024 ||
    !(await user.authenticate(password))
  ) {
    fail('Password confirmation failed.');
  }
  if (
    !(await mfa.verifyAndConsume(
      user._id,
      req.body.code,
      Date.now(),
      user.authVersion || 0,
    ))
  ) {
    fail('Authenticator or recovery code is invalid.');
  }
  return user;
}

async function challengedStaff(req) {
  const challenge = req.session?.mfaChallenge;
  if (!mfa.challengeIsValid(challenge)) fail('Sign in again.', 401);
  const user = await mongoose.model('User').findOne({
    _id: challenge.userId,
    authVersion: challenge.authVersion,
    mfaEnabled: true,
    roles: { $nin: ['suspended'] },
  });
  if (!user || !mfa.isPrivileged(user)) fail('Sign in again.', 401);
  return user;
}

async function saveCeremony(req, user, type, options, extra = {}) {
  const ceremonyId = crypto.randomBytes(32).toString('hex');
  await mongoose.model('PasskeyCeremony').create({
    _id: ceremonyId,
    user: user._id,
    session: sessionBinding(req),
    authVersion: user.authVersion || 0,
    type,
    challenge: options.challenge,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    ...extra,
  });
  return { ceremonyId, options };
}

async function consumeCeremony(req, user, type) {
  const ceremony = await mongoose.model('PasskeyCeremony').findOneAndDelete({
    _id: typeof req.body.ceremonyId === 'string' ? req.body.ceremonyId : '',
    user: user._id,
    session: sessionBinding(req),
    authVersion: user.authVersion || 0,
    type,
    expiresAt: { $gt: new Date() },
  });
  if (!ceremony) fail('Passkey request has expired. Try again.');
  return ceremony;
}

export async function list(req) {
  if (!req.user || !mfa.isPrivileged(req.user))
    fail('Staff account required.', 403);
  const rows = await mongoose
    .model('MemberPasskey')
    .find({ user: req.user._id })
    .sort({ createdAt: -1 });
  return rows.map(row => ({
    id: row.id,
    label: row.label,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
  }));
}

export async function registrationOptions(req) {
  const { rpId } = deployment();
  const user = await confirmedStaff(req);
  const keys = await mongoose.model('MemberPasskey').find({ user: user._id });
  if (keys.length >= 10) fail('Remove a passkey before adding another.');
  const label = typeof req.body.label === 'string' ? req.body.label.trim() : '';
  if (!label || label.length > 64)
    fail('Enter a passkey name of 1–64 characters.');
  // The user handle is stable across this member's credentials and is unrelated
  // to their email or username.
  const userHandle = crypto
    .createHash('sha256')
    .update('trustroots-passkey:' + rpId + ':' + user.id)
    .digest('base64url');
  const options = await webauthn.generateRegistrationOptions({
    rpName: 'Trustroots',
    rpID: rpId,
    userID: Buffer.from(userHandle, 'base64url'),
    userName: user.username,
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'required',
    },
    excludeCredentials: keys.map(key => ({
      id: key.id,
      transports: key.transports,
    })),
  });
  return saveCeremony(req, user, 'registration', options, {
    label,
    userHandle,
  });
}

export async function register(req) {
  const { rpId, origins } = deployment();
  // Fresh credential confirmation took place when options were issued; the
  // consumed ceremony binds that confirmation to this session and authVersion.
  if (
    !req.user ||
    !mfa.isPrivileged(req.user) ||
    req.user.mfaEnabled !== true ||
    req.user.$locals?.mfaVerified !== true
  ) {
    fail('A verified staff account is required.', 403);
  }
  const user = await mongoose.model('User').findOne({
    _id: req.user._id,
    authVersion: req.user.authVersion || 0,
    mfaEnabled: true,
    roles: { $nin: ['suspended'] },
  });
  if (!user || !mfa.isPrivileged(user)) fail('Sign in again.', 403);
  const ceremony = await consumeCeremony(req, user, 'registration');
  const result = await webauthn.verifyRegistrationResponse({
    response: req.body.response,
    expectedChallenge: ceremony.challenge,
    expectedOrigin: origins,
    expectedRPID: rpId,
    requireUserVerification: true,
  });
  if (!result.verified) fail('Passkey registration was not accepted.');
  const { credential, credentialDeviceType, credentialBackedUp } =
    result.registrationInfo;
  await mongoose.model('MemberPasskey').create({
    _id: credential.id,
    user: user._id,
    userHandle: ceremony.userHandle,
    label: ceremony.label,
    publicKey: Buffer.from(credential.publicKey),
    counter: credential.counter,
    transports: credential.transports,
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
  });
  return { registered: true };
}

export async function authenticationOptions(req) {
  const { rpId } = deployment();
  const user = await challengedStaff(req);
  const keys = await mongoose.model('MemberPasskey').find({ user: user._id });
  if (!keys.length)
    fail('No passkey is available. Use your authenticator or recovery code.');
  const options = await webauthn.generateAuthenticationOptions({
    rpID: rpId,
    userVerification: 'required',
    allowCredentials: keys.map(key => ({
      id: key.id,
      transports: key.transports,
    })),
  });
  return saveCeremony(req, user, 'authentication', options);
}

export async function authenticate(req) {
  const { rpId, origins } = deployment();
  const user = await challengedStaff(req);
  const ceremony = await consumeCeremony(req, user, 'authentication');
  const key = await mongoose
    .model('MemberPasskey')
    .findOne({
      _id:
        typeof req.body.response?.id === 'string' ? req.body.response.id : '',
      user: user._id,
    })
    .select('+publicKey');
  if (!key) fail('Passkey verification was not accepted.');
  const result = await webauthn.verifyAuthenticationResponse({
    response: req.body.response,
    expectedChallenge: ceremony.challenge,
    expectedOrigin: origins,
    expectedRPID: rpId,
    requireUserVerification: true,
    credential: {
      id: key.id,
      publicKey: new Uint8Array(key.publicKey),
      counter: key.counter,
      transports: key.transports,
    },
  });
  if (!result.verified) fail('Passkey verification was not accepted.');
  const updated = await mongoose.model('MemberPasskey').findOneAndUpdate(
    {
      _id: key.id,
      user: user._id,
      counter: key.counter,
    },
    {
      $set: {
        counter: result.authenticationInfo.newCounter,
        backedUp: result.authenticationInfo.credentialBackedUp,
        lastUsedAt: new Date(),
      },
    },
  );
  if (!updated) fail('Passkey changed. Try again.');
  const current = await mongoose.model('User').findOne({
    _id: user._id,
    authVersion: user.authVersion || 0,
    mfaEnabled: true,
    roles: { $nin: ['suspended'] },
  });
  if (!current || !mfa.isPrivileged(current)) fail('Sign in again.', 401);
  current.$locals.mfaVerified = true;
  return current;
}

export async function remove(req) {
  const user = await confirmedStaff(req);
  const key = await mongoose.model('MemberPasskey').findOneAndDelete({
    _id: req.params.id,
    user: user._id,
  });
  if (!key) fail('Passkey not found.', 404);
  // TOTP enrolment remains required, so removing the last optional passkey
  // never removes the account's established second factor.
  return { removed: true };
}

export default {
  list,
  registrationOptions,
  register,
  authenticationOptions,
  authenticate,
  remove,
};
