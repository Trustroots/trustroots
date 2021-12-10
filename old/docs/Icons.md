# Icons

## Icons are from Fontello

[fontello.com](https://fontello.com/) (GitHub)[https://github.com/fontello/fontello]

- Read about [design prinsibles when using icons](Design-prinsibles.md).
- [Read more about Fontello](../modules/core/client/fonts/fontello/README.txt).
- [See the current set of icons](../modules/core/client/fonts/fontello/demo.html).

## HTML example

```html
<i class="icon-newiconname"></i>
```

## To add new icons

- Open http://fontello.com
- Drag and drop `modules/core/client/fonts/fontello/config.json` over the page
- Find the icon you need and select it
- Check from names that the name makes sense
- Press arrow next to “download”, hit “config only”
- Save config file over the old file in `modules/core/client/fonts/fontello/config.json`
- Run `npm run fontello`
- Done! You can use the new icon like so: `<i class="icon-newiconname"></i>`
