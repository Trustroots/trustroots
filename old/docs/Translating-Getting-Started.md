# Getting started with Translating

This is a brief introduction to working with translating/reviewing for Trustroots. If you have questions that are not answered below, you are welcome to contact the localisation team, which at the moment is easiest to do through the specific Slack channel.

## Using Weblate

We are currently using Weblate for localisation, you can find basic information on how to work with the tool below:

- You can find the Trustroots localisation files at: https://hosted.weblate.org/projects/trustroots/
- In order to save segments instead of just suggesting translations you need to register (accounts on GitHub etc. also accepted).
- In your Weblate Settings you can, apart from your working language(s), add any secondary languages that you understand. This will show available translations in addition to the source string, which can help out with context.
- Clicking on "Languages" on the /trustroots page lets you choose the language you want to work on (with "Browse").
- On the language page you will see a list of available files as well as information on how much has been translated in each file and so on. From here you can either open individual files and start from the first segment, or you can click on the number of comments to show only commented segments etc.
- If you want to add a new language (opening a Component and clicking "Start new translation") but have problems doing so, get in touch with the localisation team and we will try to sort it out.

## Translations

If you are the first person to work on a language, or if there are still untranslated segments, the pointers below might be of use:

- For context it can be helpful to have Trustroots open either in another window (side by side) or in another tab that you can switch to easily (see your browser specifications for shortcuts).
- If you feel sure about your translation, use the button "Save", otherwise you can use "Suggest" to mark it up for review.
- Do not translate placeholders! (but remember to include them in your translation):
  - Words in {{double curly brackets}} should stay as they are.
  - Tags such as <1>, <2>, </1>, </2> etc. should be left, but the words in between should be translated (these tags will be replaced by html tags later).
- If you want to you can create a glossary for terms that are used frequently. You can also have a look at the glossaries for other languages for ideas of what to include.
  - You can add words/terms either by clicking "Add word to glossary" in the editor or going straight to the glossary under /trustroots.
  - When a word has been added to the glossary it will show as a suggestion when occurring in part of a string.
- Context issues:
  - If context is unclear and you cannot find the segment in Trustroots, you can also check "Other languages" to see how others have translated the segment.
  - If your uncertainty is language-related (e.g. whether Term A sounds better then Term B in your language), add a comment to the segment so that the reviewer can consider the options and discuss them with you.
    - If you have grave doubts it is better to "Suggest" than "Save" the translation.
  - If it is a general question that could apply to other/all languages instead, please check if it has already been mentioned among the <a href="https://codi.kanthaus.online/s/translationqueries#">Translation Queries</a>. If not, feel free to add it there and notify the rest of the localisation team to get feedback on your query.
- If you look at segments marked up as "Checks" you can find simple errors such as differing end punctuation, incorrect tags etc.
- See the last reviewer note below, it applies to you too :)

## Review

If the translation has been completed, the next step is a review by another person, which would generally go something like this:

- Read through all the files and make sure the language sounds natural, that there are no typos, grammatical errors etc., and pay attention to potential comments.
  - If answering a comment, use "@" to notify the other person of your answer.
- If something is not technically incorrect, but sounds strange to you, discuss it with the translator to find the best solution.
- Make sure that there are no errors such as untranslatable tags that have been translated etc.
- Go through segments marked up as "Checks" to make sure that the only ones remaining are false positives suitable for your language.
- Remember that although people can have strong opinions on language, you are working with the translator, not against them. Good communication tends to make this less of an issue.

## Conflict Resolution

Occasionally there might be disagreements on how to translate certain terms or what register to use etc. In these situations you should try to explain your point of view while listening to that of others - aiming to finding common ground to make a decision from. If it, for some reason, is not possible to come to an agreement we would recommend getting in touch with the others in the localisation team (through Slack or any other communications channel) in order to get more neutral opinions on the matter and, if needed, a moderated video conversation or a similar solution to find a way to resolve the conflict.

## Deploying changes

- After you make changes on Weblate, they appear at [GitHub as a pull request](https://github.com/Trustroots/trustroots/pulls?q=is%3Apr+author%3Aweblate+). Changes get piled into one pull request until that gets "merged". You can subscribe to the pull request in Github to get notified when the pull request gets merged.
- After merging, changes will appear on the developer's local setups as well on [the dev2](https://dev2.trustroots.org/) environment.
- Changes need manual deployment to appear on the production site, which we do every now and then, usually within a week or two. Feel free to ask for a new deployment if you think there is a need.

## Tech

- Strings are located in json files: https://github.com/Trustroots/trustroots/tree/master/public/locales
- Is it possible to get Weblate to integrate new languages automatically?

Please see the [Developer’s guide to internationalization](./i18n.md) for more details.
