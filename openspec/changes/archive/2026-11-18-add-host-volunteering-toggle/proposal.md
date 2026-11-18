# Add a volunteering option to hosting offers

Related to https://github.com/Trustroots/trustroots/issues/1092.

Builds on [@sitarane's suggestion](https://github.com/Trustroots/trustroots/issues/1092#issuecomment-535111020)
to add a toggle and search filter while keeping the details in the description.

## Why

Some hosts welcome help from their guests, particularly during longer stays.
Members currently have to discover these arrangements by reading descriptions.

## What Changes

Keep this close to ordinary hosting:

- Add a hosting-offer toggle: "Volunteering: can your guests help you with something?"
- Add an "Offers volunteering" search filter to find hosts who enable it.
- Keep all arrangements and expectations in the existing hosting description.

The toggle is optional and off by default. Existing hosting offers, locations,
availability and visibility rules keep their current behaviour. There is no
separate volunteering offer or additional description. Seasonal dates and
structured exchange details are outside this initial proposal.

The offers and search modules use an optional `volunteering` boolean in the
hosting API, editor support, a visible label on offers and a persisted search
filter. Missing values mean false; updates omitting the value preserve the saved
setting. No database backfill is required. The web and API are included; native
controls can follow separately.

## Initial decisions

- Use the suggested toggle wording and show an "Offers volunteering" label.
- Ask hosts to explain whether help is optional or expected and what they offer
  in their existing description.
- Keep existing map colours; the label distinguishes volunteering offers.
- Limit the first release to the web and API.
- Enabling the search filter includes hosts and narrows results to volunteering
  hosting offers, while retaining other search and privacy restrictions.
