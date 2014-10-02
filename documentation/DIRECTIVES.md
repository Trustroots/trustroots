# Trust Roots Directives

Always prefix directive with "tr", eg. `/public/modules/users/directives/tr-avatar.client.directive.js`. Place directive views under module's `/views/` folder, for example `/public/modules/users/views/directives/monkeybox.client.view.html`.

## trAvatar
User's avatar. Links to user's profile.
Usage:
`<div tr-avatar data-username="username"></div>`

## trUserBadge
Badge with username and avatar. Links to user's profile.
Pass user object for it.
Usage:
`<div tr-user-badge data-user="user"></div>`

## trAutoFocus
Focus cursor into this input when it is rendered. Don't place multiple of these per page.
Usage:
`<input type="text" tr-auto-focus>`


