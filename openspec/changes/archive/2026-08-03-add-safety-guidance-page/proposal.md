# Add public safety guidance

## Why

Trustroots relies on members making informed decisions about meeting, hosting,
and staying with people they have not met before. The site currently has rules
and support routes but no dedicated, discoverable guidance that helps hosts and
travellers reduce risk, communicate boundaries, report concerns, and respond to
emergencies.

## What Changes

- Add a public `/safety` page with practical guidance for before a meeting,
  first meetings, stays, gender-related safety concerns, community reporting,
  emergencies, accountability, and volunteering.
- Link the safety page from the homepage, shared footer, signed-in desktop
  menus, and the mobile member navigation page.
- Cross-link the safety guidance from the Rules page.
- Show a safety-guidance link in the empty state where a member starts a new
  conversation.
- Include the safety page in the public sitemap and end-to-end feature
  catalogue.

## Affected Modules

- `modules/pages` (route, page component, Rules cross-link, and tests)
- `modules/core` (desktop navigation, shared footer, and tests)
- `modules/messages` (new-conversation safety reminder and tests)
- `public/sitemap.xml`
- `tests/e2e` (public-page and navigation coverage)

## Compatibility and Deployment

- The page is public and does not change authentication, member data, or server
  APIs.
- Existing routes and navigation destinations remain unchanged.
