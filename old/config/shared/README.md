# Shared config files between client-side and server-side

## Supported locales

The locales currently supported by the app are specified in [locales.json](./locales.json). Add a language there if you want to support a new translation.

To expose locale in production, set `production:true`. Threshold for publishing is ~50% translated status. Don't un-publish translations from production because members might be using those locales.

Find the allowed language names, codes and pluralization suffixes at [a little utility](https://jsfiddle.net/jamuhl/3sL01fn0/#tabs=result).

Look for language codes in [iana.org registry](https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry).
