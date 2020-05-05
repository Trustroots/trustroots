# Example: Migrate async.waterfall to ES2018

How to rewrite [async.waterfall](https://caolan.github.io/async/docs.html#waterfall) with [async/await](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function)?

_Remember:_ [Awaiting](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await) is meaningful with [Promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) only.

### Here's some original code

[users.authentication.server.controller.js](../modules/users/server/controllers/users.authentication.server.controller.js)

```js
/**
 * Confirm email POST from email token
 */
exports.confirmEmail = function (req, res) {
  async.waterfall(
    [
      function (done) {
        // Check if user exists with this token
        User.findOne(
          {
            emailToken: req.params.token,
          },
          function (err, user) {
            if (!err && user) {
              // Will be the returned object when no errors
              var result = {};

              // If users profile was hidden, it means it was first confirmation email after registration.
              result.profileMadePublic = !user.public;

              done(null, result, user);
            } else {
              return res.status(400).send({
                message: 'Email confirm token is invalid or has expired.',
              });
            }
          },
        );
      },

      // Update user
      // We can't do regular `user.save()` here because we've got user document with password and we'd just override it:
      // Instead we'll do normal Mongoose update with previously fetched user ID
      function (result, user, done) {
        User.findOneAndUpdate(
          { _id: user._id },
          {
            $unset: {
              emailTemporary: 1,
              emailToken: 1,
              // Note that `publicReminderCount` and `publicReminderSent` get reset now each
              // time user confirms any email change, even if they didn't confirm their profile yet.
              // That's fine: we'll just start sending 'finish signup' notifications from scratch
              // to the new email. That old email before the change might've been wrong anyway...
              publicReminderCount: 1,
              publicReminderSent: 1,
            },
            $set: {
              public: true,
              // Welcome sequence emails are sent in time intervals
              welcomeSequenceSent: new Date(),
              // Replace old email with new one
              email: user.emailTemporary,
              // @todo: this should be done at user.server.model.js
              emailHash: crypto
                .createHash('md5')
                .update(user.emailTemporary.trim().toLowerCase())
                .digest('hex'),
            },
          },
          {
            // Return the document after updates if `new = true`
            new: true,
          },
          function (err, modifiedUser) {
            done(err, result, modifiedUser);
          },
        );
      },

      function (result, user, done) {
        req.login(user, function (err) {
          done(err, result, user);
        });
      },

      function (result, user) {
        // Return authenticated user
        // Remove sensitive data befor sending user
        result.user = userProfile.sanitizeProfile(user);

        return res.json(result);
      },
    ],
    function (err) {
      if (err) {
        return res.status(400).send({
          message: errorService.getErrorMessage(err),
        });
      }
    },
  );
};
```

### ...and here is the same code written with async/await

```js
/**
 * Confirm email POST from email token
 */
exports.confirmEmail = async function (req, res) {
  // Check if user exists with this token
  // ***** We await Promise instead of using callback ***** //
  let user;
  try {
    user = await User.findOne({ emailToken: req.params.token }).exec(); // ***** this returns Promise ***** //
    if (!user) throw new Error('user not found'); // ***** the logic changed a bit ***** //
  } catch (err) {
    // ***** we catch mongoose errors and also 'user not found' error from above ***** //
    return res.status(400).send({
      message: 'Email confirm token is invalid or has expired.',
    });
  }

  try {
    // ***** This is a big try/catch block that takes care of all unexpected errors ***** //
    // Will be the returned object when no errors
    var result = {};

    // If users profile was hidden, it means it was first confirmation email after registration.
    result.profileMadePublic = !user.public;

    // Update user
    // We can't do regular `user.save()` here because we've got user document with password and we'd just override it:
    // Instead we'll do normal Mongoose update with previously fetched user ID
    const modifiedUser = await User.findOneAndUpdate(
      // ***** returns a Promise ***** //
      { _id: user._id },
      {
        /*****
          ... no need to repeat ...
        *****/
      },
      {
        // Return the document after updates if `new = true`
        new: true,
      },
    ).exec(); // again, this is how we make a mongoose query return a Promise

    const util = require('util'); // we normally keep `require` on top of the file
    const promisifiedLogin = util.promisify(req.login); // make a Promise function from callback function

    await promisifiedLogin(modifiedUser); // ***** hey we didn't test this, but it probably works ***** //

    // Return authenticated user
    // Remove sensitive data befor sending user
    result.user = userProfile.sanitizeProfile(modifiedUser);

    return res.json(result);
  } catch (err) {
    // ***** here we catch unexpected errors and return an error message ***** //
    return res.status(400).send({
      message: errorService.getErrorMessage(err),
    });
  }
};
```
