var Agenda = require('agenda'),
    config = require('../config');

module.exports = new Agenda({
  db: {
    address: config.db.uri,
    collection: 'agendaJobs'
  }
});
