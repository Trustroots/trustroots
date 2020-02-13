# Design principles

Design principles to follow while building Trustroots interfaces.

#### In this guide:

- [Feature creep](#feature-creep)
- [Icons](#icons)
- [Language](#language)
- [Don't use loading spinners](#dont-use-loading-spinners)
- [Colours](#colours)

### Feature creep

Our features list is kept short and simple. While many things would be awesome to have, it sometimes makes more sense to make less but better. Avoid clutter and keep things simple.

### Icons

Use icons to help with scannability to help with recognising parts of the interface.

Typically, using only icons to convey features (for example as a button) is not enough to create clear and intuitive interfaces and can cause confusion and frustration.

Leave out the guesswork and write "Modify" instead of using a pen icon.

Exceptions could be simple things such as using "✗" for closing, "+" and "-" for adding/subtracting or zooming, "✔︎" for selections and showing something is done or success etc.

Icons work when used together with labels but to keep interfaces "light" it's important to use them selectively; not for everything.

### Language

Communicate clearly, using inclusive, to the point -language across interfaces.

Feel free to add phrases such as "well done!" or "oops!" to make it more playful especially around success confirmations, warnings and errors but don't overdo it.

In public facing interfaces, avoid technical terms that might not be familiar with all members, or that might sound cold.

For example, use:

- "Members" instead of "users".
- "Profile photo" instead of "avatar".
- "Website address" instead of "URL"

### Don't use loading spinners

Oftentimes we know the form of the content user is about to see; we just need to load it. With that information, we can show a "shadow" placeholder of the content with pulsating animation telling users that "wait, data is arriving".

For example, when opening a message inbox, we can show a few grey boxes in the shape and size of messages.

[See example](https://medium.com/anatomy-of-web-interface/placeholder-loading-ui-bbaf2222f95f).

We have a lot of _"Wait a moment"_ -text placeholders currently in our codebase and we should aim to re-design away from these while [refactoring to use React](React.md).

### Colours

Don't add new unplanned colour variations to our palette. Always use colours from variables instead of adding HEX codes directly in stylesheets. This keeps number of colour variations in check.

Use [colour contrast checker](https://webaim.org/resources/contrastchecker/) to confirm that colour combinations follow our [accessibility standards](Accessibility.md).
