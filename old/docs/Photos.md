# Photos

## Are you a photographer?

Trustroots needs fresh photos every now and then. Would be great if you could **donate your travel photos** to us! Would be good to have them under some license such as [Creative Commons SA](http://creativecommons.org/licenses/by-sa/4.0/) (recommended), but this is not required. Just add them under "Photo donations" title. Add also info how to contact you.

## Photos to use

- [Friends in Sierra nevada](https://github.com/Trustroots/trustroots/blob/917843c21d73d7548db971619857fffb8d07ff2e/public/img/board/ss-sierranevada.jpg) by [Simona](http://www.wanderlust.lt)
- [Hitchhiker playing guitar](https://github.com/Trustroots/trustroots/blob/917843c21d73d7548db971619857fffb8d07ff2e/public/img/board/ab-hitchroad.jpg) by [Andrew W Bugelli](http://www.containstraces.blogspot.com.tr/)

## Photo donations

- [Wesley Stanford](http://instagram.com/dualhorizons/) ([Dualhorizons](http://www.dualhorizons.blogspot.co.uk/))
- [Michele](https://500px.com/mcolombo) ([contact](http://about.me/amcolombo))
- [Andrea](https://www.flickr.com/photos/andreanieblas/sets/72157651420097125/) ([contact](https://www.trustroots.org/profile/alenieblas))
- [Jess Hunt](https://instagram.com/fortysixxandtwo)
- [@thetravellersjournal](https://instagram.com/thetravellersjournal/)
- [@serialhikers](https://www.instagram.com/serialhikers/) (contact them for higher resolution)

##### Submission threads at FB:

- [Nomads page](https://www.facebook.com/groups/FREE.NOMADS/permalink/1653754038169644/)
- [HW page](https://www.facebook.com/Hitchwiki/photos/a.154040317968626.29310.133644853341506/964500963589220/?type=1&theater)
- [TR page](https://www.facebook.com/trustroots.org/photos/a.433672670113514.1073741830.294353200712129/493663354114445/?type=1&theater)
- [Hitchgathering group](https://www.facebook.com/groups/hitchgathering/permalink/1125122384167993/)

### I found these photos, they'd be great, but haven't asked them yet:

_(If you're the photographer — feel free to [contact](http://ideas.trustroots.org/contact) us to give us permission to use your material.
We're a non-profit volunteer project.)_

- [Vagabundus](http://vagabundus.net/#/galleries) ([blog](http://vagabundus.net/blog/))
- [MadeByFinn](http://www.madebyfinn.com/)
- [Matthew R. Thornton](http://www.matthewrthornton.com/)
- https://www.facebook.com/groups/FREE.NOMADS/permalink/1674692949409086/
- http://www.emmavepsa.com/

## Photos from other sources

- Flickr has [quite a lot of Creative Commons media](https://www.flickr.com/search/?text=hitchhiking&sort=relevance&license=1%2C2%2C3%2C4%2C5%2C6)
- [Wikipedia Commons](https://commons.wikimedia.org/) has a lot of photos as well.
- [Hitchwiki](https://hitchwiki.org/en/Press_images) has a press image section as well with related images from the community.
- https://unsplash.com/ - [Creative commons zero](https://unsplash.com/license)

## Adding photos

- General atmosphere in photos should be dreamy, magical, wanderlust. Communicate tranquillity or crazy in a happy way (e.g. laughing friends).
- Landscapes. Make them 1100px wide. Make them hazy blue-green-yellow'ish. [Check toner psd](https://github.com/Trustroots/media/blob/master/photos/photos-color-effect.psd).
- Add photos+credits to [boards directive](https://github.com/Trustroots/trustroots/blob/master/modules/core/client/directives/tr-boards.client.directive.js). Actual files go to under [core/img/boards/](https://github.com/Trustroots/trustroots/tree/master/modules/core/client/img/board).
- Use them at `board` elements: `<div class="board" tr-boards="['foo', 'bar']"></div>` (will randomly pick one) or just one: `<div class="board" tr-boards="'oneimage'"></div>`.
- At the [blog](http://ideas.trustroots.org]) you can add credits to the caption or at the end of the article. Example:

```html
<small
  >By <a href="http://example.tld/">Joe Doe</a>,
  <a href="http://creativecommons.org/licenses/by-sa/4.0/"
    >Creative Commons</a
  ></small
>
```

## Other material

See [media](https://github.com/trustroots/media) repository for logos, screenshots etc.

## See also

- [Thread on meta: improve tribe pictures](https://meta.trustroots.org/t/improve-tribe-pictures/92)
