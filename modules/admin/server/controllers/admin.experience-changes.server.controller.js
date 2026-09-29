const crypto = require('crypto');
const mongoose = require('mongoose');

const Experience = mongoose.model('Experience');
const ExperienceChangeLink = mongoose.model('ExperienceChangeLink');
const ExperienceChangeRequest = mongoose.model('ExperienceChangeRequest');
const User = mongoose.model('User');

const isId = value => mongoose.Types.ObjectId.isValid(value);
const equals = (left, right) => String(left) === String(right);
const active = { removedAt: { $exists: false } };

exports.findExperiences = async (req, res, next) => {
  try {
    const username = String(req.query.username || '').trim();
    if (!username || username.length > 100) {
      return res.status(400).json({ message: 'Enter a member username.' });
    }
    const member = await User.findOne({ username })
      .select('_id username displayName')
      .lean()
      .exec();
    if (!member) return res.json([]);

    const experiences = await Experience.find({
      ...active,
      $or: [{ userFrom: member._id }, { userTo: member._id }],
    })
      .sort({ created: -1 })
      .limit(100)
      .populate('userFrom userTo', 'username displayName')
      .lean()
      .exec();
    return res.json(experiences);
  } catch (error) {
    return next(error);
  }
};

exports.issueLink = async (req, res, next) => {
  try {
    if (!isId(req.params.id) || !isId(req.body.memberId)) {
      return res.status(400).json({ message: 'Invalid Experience or member.' });
    }
    const experience = await Experience.findOne({
      _id: req.params.id,
      ...active,
    })
      .lean()
      .exec();
    if (!experience)
      return res.status(404).json({ message: 'Experience not found.' });
    if (
      !equals(experience.userFrom, req.body.memberId) &&
      !equals(experience.userTo, req.body.memberId)
    ) {
      return res
        .status(400)
        .json({ message: 'Member is not part of this Experience.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await ExperienceChangeLink.findOneAndUpdate(
      { experience: experience._id, member: req.body.memberId },
      { tokenHash, expiresAt, issuedBy: req.user._id, createdAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).exec();

    return res.status(201).json({
      path: `/experiences/${experience._id}/change?secret=${token}`,
      expiresAt,
    });
  } catch (error) {
    return next(error);
  }
};

exports.listRequests = async (req, res, next) => {
  try {
    const requests = await ExperienceChangeRequest.find({ active: true })
      .sort({ createdAt: 1 })
      .limit(100)
      .populate('experience')
      .populate('requester', 'username displayName')
      .lean()
      .exec();
    return res.json(requests);
  } catch (error) {
    return next(error);
  }
};

exports.decide = async (req, res, next) => {
  try {
    if (
      !isId(req.params.id) ||
      !['approve', 'reject'].includes(req.body.decision)
    ) {
      return res.status(400).json({ message: 'Invalid review decision.' });
    }
    const request = await ExperienceChangeRequest.findOneAndUpdate(
      { _id: req.params.id, status: 'pending', active: true },
      { $set: { status: 'processing' } },
      { new: true },
    ).exec();
    if (!request) {
      return res
        .status(409)
        .json({ message: 'This request is no longer pending.' });
    }

    try {
      if (req.body.decision === 'approve') {
        const update =
          request.kind === 'remove'
            ? { removedAt: new Date(), removedBy: req.user._id }
            : {
                feedbackPublic: request.proposed.feedbackPublic,
                recommend: request.proposed.recommend,
                interactions: request.proposed.interactions,
              };
        const result = await Experience.updateOne(
          { _id: request.experience, ...active },
          { $set: update },
        ).exec();
        if (result.matchedCount !== 1 && result.n !== 1) {
          throw new Error('Experience is no longer available for review.');
        }
      }

      request.set({
        status: req.body.decision === 'approve' ? 'approved' : 'rejected',
        active: false,
        reviewedAt: new Date(),
        reviewedBy: req.user._id,
      });
      await request.save();
      return res.json({ _id: request._id, status: request.status });
    } catch (error) {
      await ExperienceChangeRequest.updateOne(
        { _id: request._id, status: 'processing' },
        { $set: { status: 'pending' } },
      ).exec();
      throw error;
    }
  } catch (error) {
    return next(error);
  }
};
