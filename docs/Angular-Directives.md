# Trustroots Angular Directives

Note that [we are moving to React](React.md) so you should always prefer to make React Components instead of new Angular directives.

Always prefix directive with "tr", eg. [`/modules/users/client/directives/tr-avatar.client.directive.js`](https://github.com/Trustroots/trustroots/blob/master/modules/users/client/directives/tr-avatar.client.directive.js). Place directive views under module's `/views/` folder, for example [`/modules/users/client/views/directives/tr-monkeybox.client.view.html`](https://github.com/Trustroots/trustroots/blob/master/modules/users/client/views/directives/tr-monkeybox.client.view.html).

## trAvatar

User's avatar. Links to user's profile.

Usage:

```html
<div tr-avatar data-username="username"></div>
```

## trMonkeybox

A big panel with username, avatar and other info about user. Links to user's profile.
Pass user object for it.

Usage:

```html
<div tr-monkeybox data-user="user"></div>
```

## trLocation

Location input with suggestions.

Usage:

```html
<div tr-location data-location="model"></div>
```

## Flash Messages

Show success/error flash messages. Remember to add `messageCenterService` to your controller requirements.

Usage:

```javascript
messageCenterService.add('success', 'Great success!!', {
  timeout: flashTimeout,
});
```

You can use other message types:

- `info`: no severity meaning inferred from this message type.
- `warning`: warn the user about something.
- `danger`: an error has happened or a dangerous situation has been detected.
- `success`: everything went as expected.

`flashTimeout` is defined at [settings service](https://github.com/Trustroots/trustroots/blob/master/modules/core/client/services/settings.client.service.js#L15) and is currently 6 seconds. For long messages or errors you might want to put something like 10-15 seconds.

If you don't define timeout, message will stay there until next `$state` change and user can dismiss it by clicking small X icon in it.

See [message-center](https://github.com/mateu-aguilo-bosch/message-center) for more info.
