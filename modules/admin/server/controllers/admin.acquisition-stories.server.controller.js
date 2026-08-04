// External dependencies
const _ = require('lodash');
const mongoose = require('mongoose');
const natural = require('natural');
const pluralize = require('pluralize');
const stopword = require('stopword');
const winkStatistics = require('wink-statistics');
const winkTokenizer = require('wink-tokenizer');

const Offer = mongoose.model('Offer');
const User = mongoose.model('User');

/**
 * Detect commonly misspelled compound terms
 *
 * @param value {string} Term to check
 * @return {string} Correct term, or false if nothing found
 */
function joinCompoundWords(value) {
  // List of compounds, misspelled
  const compounds = [
    'be welcome',
    'couch surfing',
    'hitch hiking',
    'hitch wiki',
    'warm shower',
    'you tube',
    'hitch gathering',
  ];

  compounds.forEach(compound => {
    value = value.replace(compound, compound.replace(' ', ''));
  });

  return value;
}

/**
 * Detect synonyms
 *
 * @param value {string} Term to check
 * @return {string} Correct term, or false if nothing found
 */
function getSynonym(value) {
  // List of synonyms `term: replacement`
  const synonyms = {
    browsing: 'internet',
    bw: 'bewelcome',
    couchsurf: 'couchsurfing',
    cs: 'couchsurfing',
    fb: 'facebook',
    googled: 'google',
    googleplay: 'playstore',
    googling: 'google',
    hitchhiker: 'hitchhiking',
    hitchhikingwiki: 'hitchwiki',
    ig: 'instagram',
    insta: 'instagram',
    interweb: 'internet',
    net: 'internet',
    nternet: 'internet',
    online: 'internet',
    searched: 'search',
    searching: 'search',
    subreddit: 'reddit',
    traveler: 'traveller',
    traveling: 'travelling',
    tube: 'youtube',
    vk: 'vkontakte',
    wa: 'whatsapp',
    warmschower: 'warmshowers',
    warmshower: 'warmshowers',
    web: 'internet',
    website: 'internet',
    wikihitch: 'hitchwiki',
    ws: 'warmshowers',
    youtuber: 'youtube',
    youtubers: 'youtube',
    yt: 'youtube',
    вк: 'vkontakte',
    вконтакте: 'vkontakte',
    интернет: 'internet',
  };

  return synonyms[value] || false;
}

/**
 * Detect typos by comparing to most popular terms using Levenshtein distance.
 *
 * @param value {string} Term to check
 * @return {string} Correct term, or false if nothing found
 */
function getCorrectTerm(value) {
  // These are popular terms, or terms that are easy to misspell
  const correctTerms = [
    'alternative',
    'article',
    'bewelcome',
    'comment',
    'community',
    'couchspinner',
    'couchsurfing',
    'duckduckgo',
    'facebook',
    'forum',
    'friend',
    'github',
    'google',
    'googleplay',
    'hitchhiker',
    'hitchhiking',
    'hitchwiki',
    'hospitality',
    'instagram',
    'internet',
    'interrail',
    'looking',
    'member',
    'nomadwiki',
    'playstore',
    'rainbow',
    'recommendation',
    'reddit',
    'social',
    'someone',
    'surfing',
    'telegram',
    'telegram',
    'trashwiki',
    'travel',
    'traveller',
    'twitter',
    'vkontakte',
    'warmshowers',
    'whatsapp',
    'youtube',
  ];

  // Don't bother if term is alredy on the list
  if (correctTerms.includes(value)) {
    return false;
  }

  const correctedTerm = correctTerms.find(term =>
    // To increase hits (but also likelyhood of false positives), use 2 or 3 as distance instead of 1
    // eslint-disable-next-line new-cap
    natural.LevenshteinDistance(term, value) === 1 ? term : false,
  );

  // If Levenshtein distance was one, consider value a typo and return correct term instead
  return correctedTerm || false;
}

/**
 * Get singular for a term
 */
function getSingular(value) {
  // Warmshowers is exception to singular rule
  pluralize.addSingularRule(/warmshowers$/i, 'warmshowers');
  return pluralize.singular(value);
}

/**
 * Strip "meaningless" English words
 * In natural language processing, "stopwords" are words that are so frequent
 * that they can safely be removed from a text without altering its meaning.
 */
function removeStopwords(string) {
  const lowerCaseString = string.toLowerCase();
  return stopword.removeStopwords(lowerCaseString.split(' ')).join(' ');
}

/**
 * Strip out TLD, so "www.hitchwiki.org" becomes "hitchwiki" etc
 */
function getDomain(hostname) {
  // Just some common ones, add more if you notice something getting to top lists
  const tld = [
    '.au',
    '.co',
    '.com',
    '.de',
    '.fr',
    '.ir',
    '.net',
    '.org',
    '.ru',
    '.ua',
    '.uk',
    '.us',
  ];
  const re = new RegExp(`(${tld.join('|').replace('.', '\\.')})$`);
  return hostname
    .replace('www.', '')
    .replace(re, '')
    .replace(/\.$/, '')
    .replace(/^(\w+\.)*/, '');
}

/*
 * Does some language manipulation to analyse common terms from answers
 *
 * @TODO: group terms into classes? https://www.npmjs.com/package/natural#classifiers
 */
function analyseStories(stories) {
  const tokenizer = winkTokenizer();
  const ft = winkStatistics.streaming.freqTable();

  stories.forEach(({ acquisitionStory }) => {
    const tokens = _.chain(acquisitionStory)
      .thru(removeStopwords)
      .thru(joinCompoundWords)
      .thru(tokenizer.tokenize)
      .value();

    // Loop and log each word (or "token")
    tokens.forEach(({ value, tag }) => {
      // Replace certain synonyms
      const synonym = getSynonym(value);
      if (synonym) {
        ft.build(synonym);
        return;
      }

      // Skip:
      // - specified terms
      // - certain types of tokens
      // - one alphabet strings (even if there are other symbols)
      //
      // This is only after synonym handling because some "tag:alien" terms are replaced as synonyms
      const skipTerms = ['www', 'com', 'net', 'org', 'via'];

      /**
       * Types of tokens to skip
       *
       * See the full list:
       *
       * @TODO — something like this should be possible?
       * ```
       * tokenizer.defineConfig({
       *   punctuation: false,
       *   symbol: false,
       *   alien: false,
       * })
       * ```
       */
      const skipTokens = [
        'emoticon',
        'punctuation',
        'symbol',
        'number',
        'alien',
      ];

      if (
        skipTokens.includes(tag) ||
        skipTerms.includes(value) ||
        value.replace(/[\W_]+/g, '').length < 3
      ) {
        return;
      }

      // Clean up URLs to hostname only, without "www."
      if (tag === 'url') {
        try {
          const url = new URL(value);
          const domain = getDomain(url.hostname); // www.hitchwiki.org → hitchwiki
          ft.build(domain);
          return;
        } catch {
          return;
        }
      }

      // Catch typos by comparing to most popular terms using Levenshtein distance
      const correctedTerm = getCorrectTerm(value);
      if (correctedTerm) {
        ft.build(correctedTerm);
        return;
      }

      // Ensure we have singulars for consistency
      value = getSingular(value);

      ft.build(value);
    });
  });

  const result = ft.result();

  return result;
}

/**
 * Get acquisition stories from users
 *
 * @return {[Promise]} List of stories
 */
function getStories() {
  return User.find(
    {
      acquisitionStory: { $exists: true, $ne: '' },
    },
    '_id acquisitionStory created displayName email emailTemporary locationFrom locationLiving member username',
  )
    .sort('-created')
    .limit(3000)
    .exec();
}

const RESTRICTED_MATCH_LIMIT = 10;
const RESTRICTED_SOURCE_LIMIT = 1000;
const MIN_IDENTIFIER_LENGTH = 4;
const MIN_FUZZY_STORY_LENGTH = 12;
const FUZZY_STORY_THRESHOLD = 0.82;

function normalizeIdentifier(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function emailLocalPart(value) {
  return value.split('@')[0];
}

function normalizeStory(value) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function getCharacterTrigrams(value) {
  const trigrams = new Set();
  for (let index = 0; index <= value.length - 3; index += 1) {
    trigrams.add(value.slice(index, index + 3));
  }
  return trigrams;
}

function getStorySimilarity(firstStory, secondStory) {
  const first = normalizeStory(firstStory);
  const second = normalizeStory(secondStory);
  if (
    first.length < MIN_FUZZY_STORY_LENGTH ||
    second.length < MIN_FUZZY_STORY_LENGTH
  ) {
    return 0;
  }

  const firstTrigrams = getCharacterTrigrams(first);
  const secondTrigrams = getCharacterTrigrams(second);
  const sharedCount = [...firstTrigrams].filter(trigram =>
    secondTrigrams.has(trigram),
  ).length;

  return (2 * sharedCount) / (firstTrigrams.size + secondTrigrams.size);
}

function getRestrictedIdentifiers(user) {
  return [
    { label: 'Username identifier', value: normalizeIdentifier(user.username) },
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
  const storyIdentifiers = [
    normalizeIdentifier(story.username),
    normalizeIdentifier(emailLocalPart(story.email)),
    normalizeIdentifier(emailLocalPart(story.emailTemporary)),
  ];
  const reasons = getRestrictedIdentifiers(restrictedUser)
    .filter(({ value }) =>
      storyIdentifiers.some(identifier => identifier.includes(value)),
    )
    .map(({ label }) => label);
  const storyText = normalizeStory(story.acquisitionStory);
  const restrictedStoryText = normalizeStory(restrictedUser.acquisitionStory);

  if (storyText && storyText === restrictedStoryText) {
    reasons.push('Acquisition story');
  } else if (
    getStorySimilarity(
      story.acquisitionStory,
      restrictedUser.acquisitionStory,
    ) >= FUZZY_STORY_THRESHOLD
  ) {
    reasons.push('Similar acquisition story');
  }

  return reasons;
}

function getRestrictedMatches(story, restrictedUsers) {
  return restrictedUsers
    .filter(user => user._id.toString() !== story._id.toString())
    .map(user => ({
      user,
      matchReasons: getRestrictedMatchReasons(story, user),
    }))
    .filter(({ matchReasons }) => matchReasons.length)
    .slice(0, RESTRICTED_MATCH_LIMIT)
    .map(({ user, matchReasons }) => ({
      _id: user._id,
      displayName: user.displayName,
      matchReasons,
      roles: user.roles,
      username: user.username,
    }));
}

function getRestrictedUsers() {
  return User.find({ roles: { $in: ['shadowban', 'suspended'] } })
    .select(
      '_id acquisitionStory displayName email emailTemporary roles username',
    )
    .sort({ created: -1, _id: 1 })
    .limit(RESTRICTED_SOURCE_LIMIT)
    .exec();
}

function storyForList(story, hostingLocation, restrictedMatches) {
  return {
    _id: story._id,
    acquisitionStory: story.acquisitionStory,
    circleCount: story.member.length,
    created: story.created,
    displayName: story.displayName,
    hostingLocation,
    locationFrom: story.locationFrom,
    locationLiving: story.locationLiving,
    restrictedMatches,
    username: story.username,
  };
}

exports.list = async (req, res) => {
  const stories = await getStories();
  if (!stories || stories.length === 0) {
    return res.send([]);
  }

  const storyUserIds = stories.map(story => story._id);
  const restrictedUsers = await getRestrictedUsers();
  const hostingOffers = await Offer.find({
    user: { $in: storyUserIds },
    type: 'host',
    status: { $in: ['yes', 'maybe'] },
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

  return res.send(
    stories.map(story =>
      storyForList(
        story,
        hostingLocationsByUser[story._id.toString()] || null,
        getRestrictedMatches(story, restrictedUsers),
      ),
    ),
  );
};

exports.getAnalysis = async (req, res) => {
  const stories = await getStories();
  const analysis = analyseStories(stories);
  res.send(analysis);
};

exports.getStorySimilarity = getStorySimilarity;
