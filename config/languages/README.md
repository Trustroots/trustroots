# Languages

The `languages.json` is a custom made file which contains languages from `languages_orig.json` that has `iso_639_2` standard defined.

cd to dir and type `ruby convert.rb`

OR

Ruby commands to make the new file out of the original:
(cd to the directory and type `irb` to open ruby console)

Two liner:
```
require 'json'

File.open('languages.json', 'w') { |f| f.write(JSON.parse(File.read("languages_orig.json")).select { |lang| lang.has_key?('iso_639_2b') && lang['type'] == "living"}.collect {|l| {l['iso_639_2b'] => l['name']} }.reduce(Hash.new, :merge).to_json)}
```

### Todo
- See [Missing languages](https://github.com/Trustroots/trustroots/issues/98)
- [Change "Modern Greek (1453-)" to just "Greek"](https://github.com/Trustroots/trustroots/commit/615cdc86636daa4d9383d24dfb6ed6c79f89546d)
