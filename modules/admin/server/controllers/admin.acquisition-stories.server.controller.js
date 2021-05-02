// External dependencies
const mongoose = require('mongoose');
const natural = require('natural');
const pluralize = require('pluralize');
const stopword = require('stopword');
const winkStatistics = require('wink-statistics');
const winkTokenizer = require('wink-tokenizer');

const User = mongoose.model('User');

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
    traveler: 'traveller',
    traveling: 'travelling',
    tube: 'youtube',
    vk: 'vkontakte',
    wa: 'whatsapp',
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
    'couchsurfing',
    'duckduckgo',
    'facebook',
    'forum',
    'friend',
    'github',
    'google',
    'hitchhiker',
    'hitchhiking',
    'hitchwiki',
    'hospitality',
    'instagram',
    'internet',
    'looking',
    'member',
    'nomadwiki',
    'playstore',
    'googleplay',
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

/*
 * Does some language manipulation to analyse common terms from answers
 *
 * @TODO: group terms into classes? https://www.npmjs.com/package/natural#classifiers
 */
function analyseStories(stories) {
  const tokenizer = winkTokenizer();
  const ft = winkStatistics.streaming.freqTable();

  stories.forEach(({ acquisitionStory }) => {
    const cleaned = removeStopwords(acquisitionStory);
    const tokens = tokenizer.tokenize(cleaned);

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
      const skipTerms = ['www', 'com', 'net', 'org'];

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
          ft.build(url.hostname.replace('www.', ''));
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
    '_id acquisitionStory created',
  )
    .sort('-created')
    .limit(3000)
    .exec();
}

exports.list = async (req, res) => {
  const stories = await getStories();
  res.send(stories || []);
};

exports.getAnalysis = async (req, res) => {
  const stories = await getStories();
  const analysis = analyseStories(stories);
  res.send(analysis);
};
