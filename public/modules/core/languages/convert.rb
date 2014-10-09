require 'json'

langs = File.read("languages_orig.json")
langs = JSON.parse(langs)
langs = langs.select { |lang| lang.has_key?('iso_639_2b') && lang['type'] == "living"}
langs = langs.collect {|lang| { lang['iso_639_2b'] => lang['name'] } }
langs = langs.reduce(Hash.new, :merge)
File.open('languages.json', 'w') { |f| f.write(langs.to_json)}