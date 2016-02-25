# Fontello icon font

CSS for these icons can be modified from `modules/core/client/less/modules/icons.less`

The app actually just includes `css/tricons-codes.css` and font files from this directory.

### Updating icons:
- Drag `modules/core/client/fonts/fontello/config.conf.json` to [Fontello.com](http://fontello.com/)
- Do your changes
- Download
- Extract new `config.json` from the zip
- Run `npm fontello`
- Update icon version date to `modules/core/client/less/modules/icons.less` (it's a cache buster)
