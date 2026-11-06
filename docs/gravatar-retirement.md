# Gravatar retirement

Issue [#3521](https://github.com/Trustroots/trustroots/issues/3521) has two stages.
The first prevents new profile selections and preserves existing images. Once a
member switches to an upload or no photo, they cannot select Gravatar again.
Signup continues to default to no photo. Existing avatar rendering, privacy
notices and email hashes remain during this transition.

## Aggregate account count

Administrators can open `/admin/gravatar` for the current count and a paginated
member list linking to existing admin profiles. The page does not fetch external
images or change accounts. The API returns no email addresses or hashes.

For an aggregate-only measurement, an authorised production operator can run this read-only query against the
production database. Record only aggregate counts and the UTC measurement date;
do not export account identifiers, email addresses or hashes.

```javascript
db.users.aggregate([
  { $match: { avatarSource: 'gravatar' } },
  { $group: { _id: null, accounts: { $sum: 1 } } },
  { $project: { _id: 0, accounts: 1 } },
]);
```

An empty result means zero affected accounts. No production count has been
measured as part of this change. The count is a prerequisite for choosing the
retirement approach; test or development database counts are not a substitute.

## Decision required before changing existing images

| Approach                                 | Member communication and consent                                                                        | Inactive accounts and unavailable images                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Ask members to upload or choose no photo | Explain the phase-out and agree a defined notice period and deadline                                    | Agree a default-avatar fallback after notice; do not leave inactive accounts unresolved                     |
| One-time import into local storage       | Obtain explicit member consent before fetching and importing; explain there is no later synchronisation | No import without consent; agree default-avatar handling for missing or invalid images and inactive members |
| Default avatar after notice              | Explain that the image will be replaced, how to upload instead and the agreed deadline                  | Apply the agreed fallback consistently after the notice period                                              |

Recommended starting point: invite members to upload a photo or choose no photo,
with a default-avatar fallback after an agreed notice period. This avoids
importing an external image without consent. This is a recommendation, not an
approved migration or a scheduled deadline.

Before implementation, record the aggregate count, approved approach, owner,
notice wording and delivery channel, transition dates, treatment of inactive
accounts, unavailable-image fallback and rollback plan. Do not change existing
members’ images until these are agreed.

## Completion criteria for the second stage

- All remaining accounts have been handled using the agreed approach.
- All avatar surfaces, including email and mobile clients, use local or default
  images, without Gravatar requests or redirects.
- Remove obsolete selectors, URL generation and avatar API overrides, the
  Gravatar image asset, DNS-prefetch entries and CSP allowances.
- Audit email-hash consumers before removing fields; do not assume the field is
  exclusively used by Gravatar.
- Update the privacy policy, service table, revision history and translations
  when external usage ends, rather than claiming it has ended during transition.
- Test migration consent where applicable, inactive accounts, unavailable images,
  local uploads, defaults and absence of external requests.

The issue stays open until this second stage is agreed and completed.
