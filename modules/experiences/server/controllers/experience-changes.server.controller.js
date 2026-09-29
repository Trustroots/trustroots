const crypto = require('crypto');
const mongoose = require('mongoose');
const config = require('../../../../config/config');
const textService = require('../../../core/server/services/text.server.service');

const Experience = mongoose.model('Experience');
const ExperienceChangeLink = mongoose.model('ExperienceChangeLink');
const ExperienceChangeRequest = mongoose.model('ExperienceChangeRequest');

const isId = value => mongoose.Types.ObjectId.isValid(value);
const equals = (left, right) => String(left) === String(right);

async function loadExperience(req, res, { allowRemoved = false } = {}) {
  if (!isId(req.params.id)) {
    res.status(400).json({ message: 'Invalid Experience identifier.' });
    return null;
  }

  const experience = await Experience.findById(req.params.id).lean().exec();
  if (
    !experience ||
    (experience.removedAt && !allowRemoved) ||
    (!equals(experience.userFrom, req.user._id) &&
      !equals(experience.userTo, req.user._id))
  ) {
    res.status(404).json({ message: 'Experience not found.' });
    return null;
  }
  return experience;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function hasValidLink(req, experience) {
  const token = req.get('X-Experience-Change-Secret');
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;

  const link = await ExperienceChangeLink.findOne({
    experience: experience._id,
    member: req.user._id,
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() },
  })
    .lean()
    .exec();
  return Boolean(link);
}

function validateEdit(body) {
  if (
    !body.proposed ||
    Object.keys(body).some(key => !['kind', 'proposed'].includes(key))
  ) {
    return null;
  }
  const proposed = body.proposed;
  if (
    Object.keys(proposed).some(
      key => !['feedbackPublic', 'recommend', 'interactions'].includes(key),
    ) ||
    typeof proposed.feedbackPublic !== 'string' ||
    !['yes', 'no', 'unknown'].includes(proposed.recommend) ||
    !proposed.interactions ||
    Object.keys(proposed.interactions).some(
      key => !['met', 'guest', 'host'].includes(key),
    ) ||
    ['met', 'guest', 'host'].some(
      key => typeof proposed.interactions[key] !== 'boolean',
    ) ||
    !['met', 'guest', 'host'].some(key => proposed.interactions[key])
  ) {
    return null;
  }

  const feedbackPublic = textService.plainText(proposed.feedbackPublic);
  if (
    feedbackPublic.length > config.limits.maximumExperienceFeedbackPublicLength
  ) {
    return null;
  }

  return {
    feedbackPublic,
    recommend: proposed.recommend,
    interactions: {
      met: proposed.interactions.met,
      guest: proposed.interactions.guest,
      host: proposed.interactions.host,
    },
  };
}

exports.readAccess = async (req, res, next) => {
  try {
    const experience = await loadExperience(req, res);
    if (!experience) return;
    if (!(await hasValidLink(req, experience))) {
      return res
        .status(403)
        .json({ message: 'This link is invalid or has expired.' });
    }

    const isAuthor = equals(experience.userFrom, req.user._id);
    return res.json({
      _id: experience._id,
      public: experience.public,
      canEdit: isAuthor,
      ...(isAuthor || experience.public
        ? {
            feedbackPublic: experience.feedbackPublic || '',
            recommend: experience.recommend,
            interactions: experience.interactions,
          }
        : {}),
    });
  } catch (error) {
    return next(error);
  }
};

exports.readMine = async (req, res, next) => {
  try {
    const experience = await loadExperience(req, res, { allowRemoved: true });
    if (!experience) return;

    const request = await ExperienceChangeRequest.findOne({
      experience: experience._id,
      requester: req.user._id,
    })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return res.json(
      request
        ? {
            _id: request._id,
            kind: request.kind,
            status:
              request.status === 'processing' ? 'pending' : request.status,
            createdAt: request.createdAt,
            reviewedAt: request.reviewedAt,
          }
        : null,
    );
  } catch (error) {
    return next(error);
  }
};

exports.submit = async (req, res, next) => {
  try {
    const experience = await loadExperience(req, res);
    if (!experience) return;
    if (!(await hasValidLink(req, experience))) {
      return res
        .status(403)
        .json({ message: 'This link is invalid or has expired.' });
    }

    const { kind } = req.body;
    if (!['edit', 'remove'].includes(kind)) {
      return res.status(400).json({ message: 'Invalid request type.' });
    }
    if (kind === 'edit' && !equals(experience.userFrom, req.user._id)) {
      return res
        .status(403)
        .json({ message: 'Only the author can propose an edit.' });
    }

    const proposed = kind === 'edit' ? validateEdit(req.body) : undefined;
    if (
      (kind === 'edit' && !proposed) ||
      (kind === 'remove' && Object.keys(req.body).some(key => key !== 'kind'))
    ) {
      return res.status(400).json({ message: 'Invalid change request.' });
    }

    const existing = await ExperienceChangeRequest.exists({
      experience: experience._id,
      status: { $in: ['pending', 'processing'] },
    });
    if (existing) {
      return res
        .status(409)
        .json({ message: 'An Experience change is already pending.' });
    }

    const request = await ExperienceChangeRequest.create({
      experience: experience._id,
      requester: req.user._id,
      kind,
      proposed,
    });
    return res.status(201).json({
      _id: request._id,
      kind: request.kind,
      status: request.status,
      createdAt: request.createdAt,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(409)
        .json({ message: 'An Experience change is already pending.' });
    }
    return next(error);
  }
};
