# Circles

## Adding new circle

Circles are added directly to the database manually.

## Adding circle image

Production circle images are kept at [their own repository](https://github.com/Trustroots/circle-images) and manually updated at the production server.

Image requirements:

- Filename should match `slug` value (the bit visible at URL) of Circle and end with `.jpg`
- Landscape
- Reasonably sized
- Work with text overlay
- Preferably have humans to be easier to identify with
- Allowed to use non-commercially (E.g. be Creative Commons licensed)

### Test images locally

To test images locally:

1. [Install Trustroots locally](./Install.md)
2. Generate new circles with `npm run seed` command.
3. Place your image file at `public/uploads-circle`. Mind the above filename instructions.
4. Start the application with `npm start`, or run `npm run generate-circle-images`
5. Additional image sizes and formats get generated at `/public/uploads-circle/image-name/*`
6. To re-generate images, remove the above folder.
