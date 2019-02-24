const path = require('path');
const fs = require('fs-extra');

/**
 * We want to process only one unsaved translation at the time.
 * Otherwise the output files will be inconsistent.
 * We make a promise chain: The next promise will start executing after the previous one finished
 */
const queue = { promise: Promise.resolve() };
function enqueue(func, ...args) {
  queue.promise = queue.promise.then(() => func(...args));
}

/**
 * Here we execute the standard request, not concerned with waiting
 */
async function processRequest(req, res) {
  // get the needed variables
  const { lng, ns } = req.params;
  const [key] = Object.keys(req.body).filter(key => key !== '_t');
  const value = (lng === 'en') ? req.body[key] : '';

  const file = path.resolve(`./public/locales/${lng}/${ns}.json`);

  try {
    // create file if it doesn't exist
    await fs.ensureFile(file);

    // read current translations or set a default
    const rawContent = await fs.readFile(file, 'utf8') || '{}';
    const content = JSON.parse(rawContent);

    // save the new translation
    await fs.writeJSON(file, { ...{ [key]: value }, ...content }, { spaces: 2 });
  } catch (e) {
    // clean up in case of an error
    await fs.writeJSON(file, {}, { spaces: 2 });
  } finally {
    await res.status(200).end();
  }
}

module.exports = (req, res) => {
  return enqueue(processRequest, req, res);
};

