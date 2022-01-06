# Languages

The `languages.json` is a custom made file which contains languages from `languages_orig.json` that has `iso_639_2` or `iso_639_3` standard defined.

To re-generate `languages.json`, run:

```bash
cd config/languages
node generate.js
```

### Todo

- See [Missing languages](https://github.com/Trustroots/trustroots/issues/98)
- If the search input for languages can one day handle 7000+ items performance wise, we can include all the living languages and dialects. Until that we're limiting this to ~500 or so.
