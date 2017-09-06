const htmlToText = require("html-to-text");

htmlToText.fromFile(
  "./mass-email-content.html",
  {
    wordwrap: 70
  },
  (err, text) => {
    if (err) return console.error(err);
    console.log(text);
  }
);
