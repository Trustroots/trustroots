# Add a volunteering option to hosting offers

Related to https://github.com/Trustroots/trustroots/issues/1092.

Builds on [@sitarane's suggestion](https://github.com/Trustroots/trustroots/issues/1092#issuecomment-535111020)
to add a toggle and search filter while keeping the details in the description.

## Why

Some hosts welcome help from their guests, particularly during longer stays.
Members currently have to discover these arrangements by reading descriptions.

## Proposed approach

Keep this close to ordinary hosting:

- Add a hosting-offer toggle: "Volunteering: can your guests help you with something?"
- Add an "Offers volunteering" search filter to find hosts who enable it.
- Keep all arrangements and expectations in the existing hosting description.

The toggle is optional and off by default. Existing hosting offers, locations,
availability and visibility rules keep their current behaviour. There is no
separate volunteering offer or additional description. Seasonal dates and
structured exchange details are outside this initial proposal.

The offers and search modules would need an optional boolean in the hosting API,
editor support, a visible label on offers and a persisted search filter. Missing
values mean false; updates omitting the value preserve the saved setting. No
database backfill is expected. Start with the web and API; native controls can
follow separately.

## Open questions

- Is the suggested toggle wording clear, and does it distinguish this from
  volunteering for Trustroots itself?
- What brief guidance would help hosts explain whether help is optional or
  expected, especially for longer stays?
- Is a visible label enough, or should these hosts also have a distinct map colour?
- Is web and API support a useful first release before native app controls?

This is a discussion proposal only; it does not implement the feature.
