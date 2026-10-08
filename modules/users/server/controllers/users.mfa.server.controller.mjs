import mongoose from 'mongoose';
import errorService from '../../../core/server/services/error.server.service.mjs';
import profileHandler from './users.profile.server.controller.mjs';
import mfaService from '../services/mfa.server.service.mjs';

const User = mongoose.model('User');

function sendInvalidCredentials(res) {
  return res.status(400).send({ message: 'Password confirmation failed.' });
}

async function findUserWithPassword(userId) {
  return User.findById(userId).exec();
}

async function confirmPassword(user, password) {
  if (typeof password !== 'string' || !password) return false;
  const valid = await user.authenticate(password);
  return valid === true;
}

function currentMember(req, res) {
  if (req.user) return req.user;
  res.status(403).send({
    message: errorService.getErrorMessageByKey('forbidden'),
  });
  return null;
}

async function validatePasswordConfirmation(req, res) {
  const member = currentMember(req, res);
  if (!member) return null;
  const user = await findUserWithPassword(member._id);
  if (!user || !(await confirmPassword(user, req.body.currentPassword))) {
    sendInvalidCredentials(res);
    return null;
  }
  return user;
}

async function beginEnrollment(req, res) {
  try {
    const user = await validatePasswordConfirmation(req, res);
    if (!user) return;
    if (user.mfaEnabled) {
      return res
        .status(409)
        .send({ message: 'Authenticator MFA is already enabled.' });
    }
    const setup = await mfaService.stageEnrollment(user._id, user.username);
    return res.json(setup);
  } catch {
    return res
      .status(503)
      .send({ message: 'Authenticator MFA is temporarily unavailable.' });
  }
}

async function verifyEnrollment(req, res) {
  if (!req.user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }
  try {
    const result = await mfaService.activateEnrollment(
      req.user._id,
      req.body.code,
    );
    if (!result) {
      return res
        .status(400)
        .send({ message: 'Authenticator code is invalid or has expired.' });
    }
    result.user.$locals.mfaVerified = true;
    return req.login(result.user, error => {
      if (error) {
        return res
          .status(503)
          .send({ message: 'Could not update the sign-in session.' });
      }
      return res.json({
        enabled: true,
        recoveryCodes: result.codes,
        user: profileHandler.sanitizeOwnProfile(result.user),
      });
    });
  } catch {
    return res
      .status(503)
      .send({ message: 'Authenticator MFA is temporarily unavailable.' });
  }
}

async function settings(req, res) {
  if (!req.user) {
    return res.status(403).send({
      message: errorService.getErrorMessageByKey('forbidden'),
    });
  }
  try {
    const user = await User.findById(req.user._id)
      .select('+mfaRecoveryCodeHashes')
      .exec();
    if (!user) return res.sendStatus(404);
    return res.json({
      enabled: user.mfaEnabled === true,
      recoveryCodesRemaining: user.mfaRecoveryCodeHashes?.length || 0,
    });
  } catch {
    return res
      .status(503)
      .send({ message: 'Authenticator MFA is temporarily unavailable.' });
  }
}

async function regenerateRecoveryCodes(req, res) {
  try {
    const user = await validatePasswordConfirmation(req, res);
    if (!user) return;
    if (!user.mfaEnabled) {
      return res
        .status(409)
        .send({ message: 'Authenticator MFA is not enabled.' });
    }
    const verification = await mfaService.verifyAndConsume(
      user._id,
      req.body.code,
    );
    if (!verification) {
      return res
        .status(400)
        .send({ message: 'Authenticator or recovery code is invalid.' });
    }
    const codes = mfaService.createRecoveryCodes();
    const hashes = codes.map(code =>
      // Stored hashes use the same one-way transformation as verification.
      mfaService.hashRecoveryCode(code),
    );
    const updated = await User.findOneAndUpdate(
      {
        _id: user._id,
        mfaEnabled: true,
        mfaSecretEncrypted: verification.secret,
      },
      { $set: { mfaRecoveryCodeHashes: hashes } },
      { new: true },
    ).exec();
    if (!updated)
      return res
        .status(409)
        .send({ message: 'Authenticator MFA changed. Try again.' });
    updated.$locals.mfaVerified = true;
    return req.login(updated, error => {
      if (error)
        return res
          .status(503)
          .send({ message: 'Could not update the sign-in session.' });
      return res.json({ recoveryCodes: codes });
    });
  } catch {
    return res
      .status(503)
      .send({ message: 'Authenticator MFA is temporarily unavailable.' });
  }
}

async function disable(req, res) {
  try {
    const user = await validatePasswordConfirmation(req, res);
    if (!user) return;
    if (!user.mfaEnabled) {
      return res
        .status(409)
        .send({ message: 'Authenticator MFA is not enabled.' });
    }
    const verification = await mfaService.verifyAndConsume(
      user._id,
      req.body.code,
    );
    if (!verification) {
      return res
        .status(400)
        .send({ message: 'Authenticator or recovery code is invalid.' });
    }
    const removed = await mfaService.removeMfa(user._id, verification.secret);
    if (!removed) {
      return res
        .status(409)
        .send({ message: 'Authenticator MFA changed. Try again.' });
    }
    return req.logout(error => {
      if (error)
        return res
          .status(503)
          .send({ message: 'Could not end the current session.' });
      return res.json({ enabled: false });
    });
  } catch {
    return res
      .status(503)
      .send({ message: 'Authenticator MFA is temporarily unavailable.' });
  }
}

const service = {
  beginEnrollment,
  disable,
  regenerateRecoveryCodes,
  settings,
  verifyEnrollment,
};

export default service;
export {
  beginEnrollment,
  disable,
  regenerateRecoveryCodes,
  settings,
  verifyEnrollment,
};
