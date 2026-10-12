/** Public roster of current Trustroots greeters. */
import mongoose from 'mongoose';
import errorService from './../../../core/server/services/error.server.service.mjs';

const User = mongoose.model('User');

export const list = (req, res) => {
  User.find({
    public: true,
    roles: { $all: ['welcome-team'], $nin: ['suspended', 'shadowban'] },
  })
    .select('username displayName')
    .sort('displayName username')
    .limit(500)
    .then(
      users => {
        res.send({
          greeters: users.map(({ _id, username, displayName }) => ({
            _id,
            username,
            displayName,
          })),
        });
      },
      err =>
        res.status(500).send({
          message: errorService.getErrorMessage(err),
        }),
    );
};

const defaultInterop = { list };
export default defaultInterop;
export { defaultInterop as 'module.exports' };
