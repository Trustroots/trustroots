// External dependencies
import mongoose from 'mongoose';
const Offer = mongoose.model('Offer');
const User = mongoose.model('User');
const Message = mongoose.model('Message');

/**
 * Get acquisition stories from users
 *
 * @return {[Promise]} List of stories
 */
function getStories(limit) {
  return User.find(
    {
      acquisitionStory: {
        $exists: true,
        $ne: '',
      },
    },
    '_id acquisitionStory created displayName email emailTemporary languages locationFrom locationLiving member public roles username',
  )
    .sort('-created')
    .limit(limit)
    .exec();
}
const RESTRICTED_MATCH_LIMIT = 10;
const RESTRICTED_SOURCE_LIMIT = 1000;
const MIN_IDENTIFIER_LENGTH = 4;
const MATCH_BATCH_SIZE = 100;
function restrictionStatuses(user) {
  return ['suspended', 'shadowban'].filter(status =>
    user.roles.includes(status),
  );
}
function normalizeIdentifier(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}
function emailLocalPart(value) {
  return value.split('@')[0];
}
function getRestrictedIdentifiers(user) {
  return [
    {
      label: 'Username identifier',
      value: normalizeIdentifier(user.username),
    },
    {
      label: 'Email identifier',
      value: normalizeIdentifier(emailLocalPart(user.email)),
    },
    {
      label: 'Temporary email identifier',
      value: normalizeIdentifier(emailLocalPart(user.emailTemporary)),
    },
  ].filter(
    ({ value }, index, identifiers) =>
      value.length >= MIN_IDENTIFIER_LENGTH &&
      identifiers.findIndex(identifier => identifier.value === value) === index,
  );
}
function getRestrictedMatchReasons(story, restrictedUser) {
  return restrictedUser.identifiers
    .filter(({ value }) =>
      story.identifiers.some(identifier => identifier.includes(value)),
    )
    .map(({ label }) => label);
}
async function getRestrictedMatches(story, restrictedUsers) {
  const preparedStory = {
    identifiers: [
      normalizeIdentifier(story.username),
      normalizeIdentifier(emailLocalPart(story.email)),
      normalizeIdentifier(emailLocalPart(story.emailTemporary)),
    ],
  };
  const matches = [];
  for (let index = 0; index < restrictedUsers.length; index += 1) {
    // Yield to I/O even when none of the candidates match. A result limit alone
    // does not bound the synchronous work for a list of 500 stories.
    if (index % MATCH_BATCH_SIZE === 0) {
      await new Promise(resolve => setImmediate(resolve));
    }
    const candidate = restrictedUsers[index];
    const { user } = candidate;
    if (user._id.toString() === story._id.toString()) {
      continue;
    }
    const matchReasons = getRestrictedMatchReasons(preparedStory, candidate);
    if (matchReasons.length) {
      matches.push({
        _id: user._id,
        displayName: user.displayName,
        matchReasons,
        restrictionStatuses: restrictionStatuses(user),
        username: user.username,
      });
      if (matches.length === RESTRICTED_MATCH_LIMIT) {
        break;
      }
    }
  }
  return matches;
}
function getRestrictedUsers() {
  return User.find({
    roles: {
      $in: ['shadowban', 'suspended'],
    },
  })
    .select('_id displayName email emailTemporary roles username')
    .sort({
      created: -1,
      _id: 1,
    })
    .limit(RESTRICTED_SOURCE_LIMIT)
    .exec();
}
function storyForList(story, hostingLocation, restrictedMatches, welcomer) {
  return {
    _id: story._id,
    acquisitionStory: story.acquisitionStory,
    circleCount: story.member.length,
    created: story.created,
    displayName: story.displayName,
    hostingLocation,
    locationFrom: story.locationFrom,
    locationLiving: story.locationLiving,
    languages: story.languages || [],
    welcomer,
    public: story.public === true,
    restrictionStatuses: restrictionStatuses(story),
    restrictedMatches,
    username: story.username,
  };
}
export const list = async (req, res) => {
  const stories = await getStories(500);
  if (!stories || stories.length === 0) {
    return res.send([]);
  }
  const storyUserIds = stories.map(story => story._id);
  const currentWelcomerIds = (
    await User.find({ roles: 'welcome-team' }).select('_id').exec()
  ).map(user => user._id);
  // Filter current team membership before selecting the first contact. Fetch
  // metadata for all recipients together, never loading message content.
  const welcomeContacts = await Message.aggregate([
    {
      $match: {
        userTo: { $in: storyUserIds },
        userFrom: { $in: currentWelcomerIds },
        shadowHidden: { $ne: true },
        $expr: { $ne: ['$userFrom', '$userTo'] },
      },
    },
    {
      $lookup: {
        from: User.collection.name,
        localField: 'userFrom',
        foreignField: '_id',
        as: 'sender',
      },
    },
    { $unwind: '$sender' },
    { $match: { 'sender.roles': 'welcome-team' } },
    {
      $project: {
        userTo: 1,
        created: 1,
        'sender._id': 1,
        'sender.username': 1,
        'sender.displayName': 1,
      },
    },
    { $sort: { created: 1, _id: 1 } },
    {
      $group: {
        _id: '$userTo',
        welcomer: {
          $first: {
            _id: '$sender._id',
            username: '$sender.username',
            displayName: '$sender.displayName',
            created: '$created',
          },
        },
      },
    },
  ]).exec();
  const welcomersByUser = new Map(
    welcomeContacts.map(contact => [contact._id.toString(), contact.welcomer]),
  );
  const restrictedUsers = (await getRestrictedUsers()).map(user => ({
    user,
    identifiers: getRestrictedIdentifiers(user),
  }));
  const hostingOffers = await Offer.find({
    user: {
      $in: storyUserIds,
    },
    type: 'host',
    status: {
      $in: ['yes', 'maybe'],
    },
  })
    .select('location locationFuzzy updated user')
    .sort('-updated')
    .exec();
  const hostingLocationsByUser = (hostingOffers || []).reduce(
    (locations, offer) => {
      const userId = offer.user.toString();
      if (!locations[userId]) {
        const location = offer.locationFuzzy.length
          ? offer.locationFuzzy
          : offer.location;
        locations[userId] = Array.from(location);
      }
      return locations;
    },
    {},
  );
  const results = [];
  for (const story of stories) {
    results.push(
      storyForList(
        story,
        hostingLocationsByUser[story._id.toString()] || null,
        await getRestrictedMatches(story, restrictedUsers),
        welcomersByUser.get(story._id.toString()) || null,
      ),
    );
  }
  return res.send(results);
};
const defaultInterop = {
  list,
};
export default defaultInterop;
export { defaultInterop as 'module.exports' };
