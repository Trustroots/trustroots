var axios = require('axios');

exports.contactsCommonListService = function (id) {
  return (
    axios.get('/api/contacts/'+ id + '/common')
      .then(function (resp) {
        return resp.data;
      })
      .catch(function (error) {
        return error;
      })
  );
};
