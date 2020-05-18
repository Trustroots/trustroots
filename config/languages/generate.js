/**
 * A script to generate `languages.json`
 *
 * Run script from the same folder (./config/languages):
 *
 * node generate.js
 */

// Dependencies
const _ = require('lodash');
const fs = require('fs');

/**
 * Helper to adjust some labels
 */
function fixName(name) {
  // More practical
  // This is the modern day language of Greeks in Greece
  if (name === 'Modern Greek (1453-)') {
    return 'Greek';
  }

  // More practical
  if (name === 'Ancient Greek (to 1453)') {
    return 'Ancient Greek';
  }

  // Follow Wikipedia's naming convention
  // @link https://en.wikipedia.org/wiki/Punjabi_language
  // if (name === 'Panjabi') {
  //   return 'Punjabi';
  // }

  return name;
}

/**
 * Determine if language should be picked and used at Trustroots
 */
function includeLanguage(language) {
  // Add individually picked languages if these languages have
  // significant "hobbyist" community around them
  if (
    [
      'grc', // Ancient Greek
      'lat', // Latin
    ].indexOf(language.iso_639_2b) > -1
  ) {
    return true;
  }

  // Include all "living" languages
  // Include 19 constructed languages such as "Esperanto"
  // Ignores all other types (e.g. extinct)
  if (['constructed', 'living'].indexOf(language.type) === -1) {
    return false;
  }

  // Include all 37 creole languages
  // `i` in regexp means "ignore case"
  if (/creole/i.test(language.name)) {
    return true;
  }

  // Include all 135 sign languages
  // Their names always end to "Sign Language" in our data
  // e.g. "Finnish Sign Language"
  if (_.endsWith(language.name, 'Sign Language')) {
    return true;
  }

  // Include everything with `iso_639_2b/b` code available
  // @link https://en.wikipedia.org/wiki/ISO_639-2#B_and_T_codes
  if (language.iso_639_2b || language.iso_639_2t) {
    return true;
  }

  // Include languages such as "Serbo-Croatian"
  // which don't necessarily have `iso_639_2b` code.
  if (language.scope === 'macro_language') {
    return true;
  }

  return false;
}

/**
 * Pick language key
 * If `iso_639_2b` exists, returns it.
 * otherwise looks for other keys and prefixes them with ISO used, e.g.:
 * `iso_639_3-LANGUAGECODE`
 */
function getKey(language) {
  if (language.iso_639_2b) {
    return language.iso_639_2b;
  }

  if (language.iso_639_2t) {
    return 'iso_639_2t-' + language.iso_639_2t;
  }

  if (language.iso_639_3) {
    return 'iso_639_3-' + language.iso_639_3;
  }

  if (language.iso_639_1) {
    return 'iso_639_1-' + language.iso_639_1;
  }

  // Failed to find key
  return false;
}

/**
 * Collect languages
 */
function collectLanguages() {
  const languagesOrig = require('./languages_orig.json');
  const languagesNew = {};

  _.forEach(languagesOrig, function (language) {
    // Pick a key
    // Most of the time `iso_639_2b` is what we need but it's not always available
    const key = getKey(language);

    if (!key) {
      console.warn('Could not generate key for language:');
      console.log(language);
      return true;
    }

    // Skip languages we don't use
    if (!includeLanguage(language)) {
      return true;
    }

    // Ensure we're not overwriting anything
    if (languagesNew[key]) {
      console.warn('Language for key ' + key + ' exists already:');
      console.log(languagesNew[key]);
      console.log('Attempted to collect language:');
      console.log(language);
      return true;
    }

    // Finally store languages by key=>name
    languagesNew[key] = fixName(language.name);
  });

  console.log(
    'Picked ' +
      _.keys(languagesNew).length +
      ' languages from total ' +
      languagesOrig.length +
      ' languages.',
  );

  return languagesNew;
}

/**
 * Generate languages and write them to a file
 */
function generate(targetFile) {
  console.log('');
  console.log('Generating languages...');

  const languages = collectLanguages();
  const languagesString = JSON.stringify(languages);

  fs.writeFile(targetFile, languagesString, function (err) {
    if (err) {
      console.error('Failed saving languages to file `' + targetFile + '`');
      console.error(err);
      return;
    }
    console.log('Languages saved to file `' + targetFile + '`');
  });
}

// Initialize
generate('languages.json');
