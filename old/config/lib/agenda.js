const Agenda = require('agenda');
const config = require('../config');

module.exports = new Agenda({
  db: {
    address: config.db.uri,
    collection: 'agendaJobs',
  },
});
