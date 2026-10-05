# Link profile roles to role-filtered user lists

## Why

Administrators can see that a member is a Greeter or volunteer, but cannot open a list of the other members with that role from the role label. Role-filtered results are also not currently addressable by a stable URL.

## What changes

- Add contact ordering by newest date or name alongside refreshed cards and initials avatars.
- Highlight matching member details and offer a return link to map search.

- Make the Greeter and volunteer role labels on the admin member page link to their respective role-filtered user lists.
- Support loading and sharing role-filtered lists at unique `/admin/search-users?role=…` URLs.
- Keep the selected role and role-list results in sync when the list is opened directly or paginated/sorted.
- Show an Admin link in the main menu for Greeters and direct it to acquisition stories.

## Capabilities

### Modified Capabilities

- `admin-moderation`: Role list links and shareable filters.
- `member-navigation`: Greeter shortcut to acquisition stories.
- `relationships-safety`: Contact list ordering.
- `offers-and-search`: Matching-text emphasis and a return link to map search.

## Impact

- Affected capabilities: admin member search and welcome-team acquisition access.
- No server API change is needed; the admin role-list API already exists.
