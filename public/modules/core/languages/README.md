The languages.json is a custom made file which contains languages from languages_orig.json that has iso_639_2 standard defined.

Ruby commands to make the new file out of the original:
(cd to the directory and type irb to open ruby console and require 'json')

```
langs = File.read("languages_orig.json")
langs_json = JSON.parse(langs)
langs_iso2 = langs_json.select { |lang| lang.has_key?('iso_639_2b')}
langs = langs_iso2.collect {|l| {'key' => l['iso_639_2b'], 'name' => l['name']} }
File.open('languages.json', 'w') { |f| f.write(langs.to_json)}
```

One liner:
`
File.open('languages.json', 'w') { |f| f.write(JSON.parse(File.read("languages_orig.json")).select { |lang| lang.has_key?('iso_639_2b')}.collect {|l| {'key' => l['iso_639_2b'], 'name' => l['name']} }.to_json)}
`