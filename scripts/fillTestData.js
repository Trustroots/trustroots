var exec = require('child_process').exec;
var tribes = exec('node ./scripts/db-seeding/fillTestTribesData.js 100');

tribes.stdout.on('data', function (data) {
  console.log(data);
});
tribes.stderr.on('data', function (data) {
  console.log(data);
});

var sequenceScriptsPromise = new Promise(function (resolve) {
  tribes.on('close', function () {
    resolve();
  });
});

sequenceScriptsPromise.then(function () {
  var users = exec('node ./scripts/db-seeding/fillTestUsersData.js 1000 admin1 admin2 admin3');

  users.stdout.on('data', function (data) {
    console.log(data);
  });
  users.stderr.on('data', function (data) {
    console.log(data);
  });
  return new Promise(function (resolve) {
    users.on('close', function () {
      resolve();
    });
  });
}).then(function () {
  var messages = exec('node ./scripts/db-seeding/fillTestMessagesData.js 1000');
  messages.stdout.on('data', function (data) {
    console.log(data);
  });
  messages.stderr.on('data', function (data) {
    console.log(data);
  });
  messages.on('close', function () {
    return;
  });
});
