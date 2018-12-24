# Icons are from Fontello

[Read more](../modules/core/client/fonts/fontello/README.txt).

[See the current set of icons](../modules/core/client/fonts/fontello/demo.html).

```html
<i class="icon-newiconname"></i>
````

## To add new icons
- Open http://fontello.com
- Drag and drop `modules/core/client/fonts/fontello/config.json` over the page
- Find the icon you need and select it
- Check from names that the name makes sense
- Press arrow next to “download”, hit “config only”
- Save config file over the old file in `modules/core/client/fonts/fontello/config.json`
- Run `npm run fontello`
- Done! You can use the new icon like so: `<i class="icon-newiconname"></i>`
