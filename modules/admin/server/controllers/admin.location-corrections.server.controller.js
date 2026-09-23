const crypto = require('crypto');
const mongoose = require('mongoose');
const config = require('../../../../config/config');
const textService = require('../../../core/server/services/text.server.service');
const userRolesService = require('../../../users/server/services/user-roles.server.service');

const Offer = mongoose.model('Offer');
const Message = mongoose.model('Message');
const Thread = mongoose.model('Thread');

// The former default is stored as latitude, longitude, as are offer locations.
const DEFAULT_LOCATION = [48.6908333333, 9.14055555556];
const HISTORIC_AREA = {
  south: 48.6825742243,
  north: 48.6978156112,
  west: 9.1301107407,
  east: 9.1519975662,
};

function isDeletionPending(user) {
  if (!user.removeProfileToken) return false;
  if (!user.removeProfileExpires) return true;
  const expiry = new Date(user.removeProfileExpires).getTime();
  return !Number.isFinite(expiry) || expiry > Date.now();
}

function isEligibleRecipient(user, senderId) {
  return (
    user &&
    user.public === true &&
    String(user._id) !== String(senderId) &&
    !userRolesService.hasRestrictedMessagingRole(user) &&
    !isDeletionPending(user)
  );
}

function classifyLocation(location) {
  if (!Array.isArray(location) || location.length !== 2) return null;
  const [latitude, longitude] = location;
  if (
    latitude < HISTORIC_AREA.south ||
    latitude > HISTORIC_AREA.north ||
    longitude < HISTORIC_AREA.west ||
    longitude > HISTORIC_AREA.east
  ) {
    return null;
  }
  return latitude === DEFAULT_LOCATION[0] && longitude === DEFAULT_LOCATION[1]
    ? 'exact'
    : 'nearby';
}

function candidateKey(userId, offers) {
  const snapshot = offers
    .map(offer => [String(offer._id), ...offer.location].join(':'))
    .sort();
  return crypto
    .createHash('sha256')
    .update(JSON.stringify([String(userId), snapshot]))
    .digest('hex');
}

function compareCandidates(a, b) {
  return a.match === b.match
    ? a.username.localeCompare(b.username)
    : a.match === 'exact'
    ? -1
    : 1;
}

async function findCandidates(senderId) {
  const offers = await Offer.find({
    location: {
      $geoWithin: {
        $box: [
          [HISTORIC_AREA.south, HISTORIC_AREA.west],
          [HISTORIC_AREA.north, HISTORIC_AREA.east],
        ],
      },
    },
    $or: [
      { type: 'host', status: { $in: ['yes', 'maybe'] } },
      { type: 'meet', validUntil: { $gt: new Date() } },
    ],
  })
    .select('_id user type status location validUntil updated')
    .populate(
      'user',
      'username displayName public roles removeProfileToken removeProfileExpires',
    )
    .exec();

  const byUser = new Map();
  for (const offer of offers) {
    const match = classifyLocation(offer.location);
    const user = offer.user;
    if (!match || !isEligibleRecipient(user, senderId)) continue;
    const userId = String(user._id);
    if (!byUser.has(userId)) {
      byUser.set(userId, {
        userId,
        username: user.username,
        displayName: user.displayName,
        offers: [],
      });
    }
    byUser.get(userId).offers.push({
      _id: offer._id,
      type: offer.type,
      location: Array.from(offer.location),
      match,
      updated: offer.updated,
    });
  }

  const candidates = Array.from(byUser.values()).map(candidate => ({
    ...candidate,
    offers: candidate.offers.sort((a, b) =>
      String(a._id).localeCompare(String(b._id)),
    ),
    match: candidate.offers.some(offer => offer.match === 'exact')
      ? 'exact'
      : 'nearby',
    key: candidateKey(candidate.userId, candidate.offers),
  }));
  const contactedKeys = candidates.map(candidate => candidate.key);
  const contacted = contactedKeys.length
    ? await Message.find({ locationCorrectionKey: { $in: contactedKeys } })
        .select('locationCorrectionKey')
        .exec()
    : [];
  const sentKeys = new Set(
    contacted.map(message => message.locationCorrectionKey),
  );
  return candidates
    .filter(candidate => !sentKeys.has(candidate.key))
    .sort(compareCandidates);
}

async function updateThread(message) {
  const pair = {
    $or: [
      { userFrom: message.userFrom, userTo: message.userTo },
      { userFrom: message.userTo, userTo: message.userFrom },
    ],
  };
  const latest = {
    updated: message.created,
    userFrom: message.userFrom,
    userTo: message.userTo,
    message: message._id,
    read: message.read,
  };
  const threadId = crypto
    .createHash('sha256')
    .update(
      JSON.stringify([String(message.userFrom), String(message.userTo)].sort()),
    )
    .digest('hex')
    .slice(0, 24);
  try {
    await Thread.updateOne(
      pair,
      { $setOnInsert: { ...latest, _id: threadId } },
      { upsert: true },
    ).exec();
  } catch (error) {
    if (error.code !== 11000) throw error;
    await Thread.updateOne(
      pair,
      { $setOnInsert: { ...latest, _id: threadId } },
      { upsert: true },
    ).exec();
  }
  await Thread.updateOne(
    { ...pair, updated: { $lt: message.created } },
    { $set: latest },
  ).exec();
}

exports.list = async (req, res) => {
  try {
    return res.send(await findCandidates(req.user._id));
  } catch {
    return res
      .status(500)
      .send({ message: 'Could not load location corrections.' });
  }
};

exports.send = async (req, res) => {
  const { userId, key, content } = req.body || {};
  if (
    !mongoose.Types.ObjectId.isValid(userId) ||
    typeof key !== 'string' ||
    !/^[a-f0-9]{64}$/.test(key) ||
    typeof content !== 'string' ||
    content.length > 5000
  ) {
    return res.status(400).send({ message: 'Invalid correction message.' });
  }
  const cleanContent = textService.html(content);
  if (!cleanContent || textService.isEmpty(cleanContent)) {
    return res.status(400).send({ message: 'Please write a message.' });
  }
  if (
    !req.user.public ||
    userRolesService.hasRestrictedMessagingRole(req.user)
  ) {
    return res.status(403).send({ message: 'Messaging is unavailable.' });
  }
  const descriptionLength = textService.plainText(
    req.user.description || '',
  ).length;
  if (descriptionLength < config.profileMinimumLength) {
    return res.status(400).send({
      message: 'Please complete your profile before sending messages.',
    });
  }

  try {
    const candidates = await findCandidates(req.user._id);
    const candidate = candidates.find(
      item => item.userId === userId && item.key === key,
    );
    const messageId = crypto
      .createHash('sha256')
      .update(`location-correction:${key}`)
      .digest('hex')
      .slice(0, 24);
    if (!candidate) {
      const prior = await Message.findById(messageId).exec();
      const changed = candidates.some(item => item.userId === userId);
      if (changed) {
        return res
          .status(409)
          .send({ message: 'The candidate has changed. Refresh the queue.' });
      }
      if (prior) await updateThread(prior);
      return res.status(prior ? 200 : 409).send({
        sent: false,
        message: prior
          ? 'This member has already been contacted.'
          : 'The candidate has changed. Refresh the queue.',
      });
    }
    let message;
    let inserted = false;
    try {
      const result = await Message.findOneAndUpdate(
        { _id: messageId },
        {
          $setOnInsert: {
            content: cleanContent,
            userFrom: req.user._id,
            userTo: candidate.userId,
            read: false,
            shadowHidden: false,
            locationCorrectionKey: key,
            locationCorrectionOffers: candidate.offers.map(offer => ({
              offer: offer._id,
              location: offer.location,
            })),
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
          rawResult: true,
        },
      ).exec();
      message = result.value;
      inserted = !result.lastErrorObject.updatedExisting;
    } catch (error) {
      if (error.code !== 11000) throw error;
      message = await Message.findById(messageId).exec();
    }
    await updateThread(message);
    return res.send({ sent: inserted, messageId: message._id });
  } catch {
    return res
      .status(500)
      .send({ message: 'Could not send the correction message.' });
  }
};

exports._test = {
  classifyLocation,
  candidateKey,
  compareCandidates,
  findCandidates,
  isEligibleRecipient,
};
