

const path = require('path');
const backend = require('../controllers/backend.server.controller');
const config = require(path.resolve('./config/config'));

module.exports = (app) => {
  if (config.i18nBackend) {
    app.route('/api/locales/:lng/:ns').post(backend);
  }
};
